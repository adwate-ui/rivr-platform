-- Play-time steps reached while the venue is frozen, promotions are stopped or the member is frozen are never paid (the
-- owner, 9 Nov: "Never pay frozen steps"). The minute's sweep paid nothing then, but weighed the same steps again once
-- released and paid them. Now it records each step reached since the stop began as skipped, and no promotion weighs a
-- skipped step again, whichever promotion's step at the same minutes is weighed (money audit, 9 Nov). A step reached
-- before the stop and not yet paid is paid once released. A step reached in the last minute of a stop, after the sweep's
-- last run in it, is paid once released: the sweep runs each minute. The minutes played when the stop began are counted
-- from the visit's seat time now, which takes off time away since: a step reached in the minute before a stop, not yet
-- paid, is skipped if the member then steps away (money audit, 9 Nov).

-- A play-time step skipped for a visit: the promotion, the member, the visit and the step's place among the promotion's
-- steps (decision 0511), and why. Written only by the sweep.
create table public.promotion_step_skip (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  promotion_id uuid not null,
  member_id uuid not null,
  visit_id uuid not null references public.visit (id),
  step_number integer not null check (step_number > 0),
  reason text not null default 'stopped' check (reason = 'stopped'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promotion_id, member_id, visit_id, step_number),
  foreign key (promotion_id, venue_id) references public.promotion (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.promotion_step_skip is 'A play-time step reached while the venue was frozen, promotions stopped or the member frozen: never paid.';

create index promotion_step_skip_member_idx on public.promotion_step_skip (member_id, venue_id);
create index promotion_step_skip_visit_idx on public.promotion_step_skip (visit_id);

create trigger promotion_step_skip_touch_updated_at before update on public.promotion_step_skip
  for each row execute function private.touch_updated_at();
create trigger promotion_step_skip_audit after insert or update or delete on public.promotion_step_skip
  for each row execute function private.audit_row_change();

alter table public.promotion_step_skip enable row level security;
grant select on public.promotion_step_skip to authenticated;
create policy "staff who manage promotions see the venue's skipped steps" on public.promotion_step_skip
  for select to authenticated using (venue_id in (select private.venues_where('promotions.manage')));

-- A member's export gives their skipped steps, as their grants.
insert into private.member_export_column (table_name, column_name, kind)
select 'promotion_step_skip', c, 'owed' from unnest(array['id', 'venue_id', 'promotion_id', 'member_id', 'visit_id', 'step_number', 'reason',
  'created_at', 'updated_at']) as c;

-- 20261109260000's promo_step_settled, with a step skipped during a stop settled too: never paid.
create or replace function private.promo_step_settled(p_promotion_id uuid, p_member_id uuid, p_visit_id uuid, p_step integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.promotion_grant g
                 where g.promotion_id = p_promotion_id and g.member_id = p_member_id and g.source_key like 'hours_step:' || p_visit_id || ':%'
                   and g.period_key ~ ('@' || p_step || '(#[0-9]+)?$'))
      or exists (select 1 from public.promotion_step_skip k
                 where k.promotion_id = p_promotion_id and k.member_id = p_member_id and k.visit_id = p_visit_id and k.step_number = p_step);
$$;

-- As 20261109180000_hours_bonus_steps.sql made it, a step weighed by its place, and one reached during a stop skipped for
-- good.
create or replace function private.weigh_hours_steps(p_visit_id uuid, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_table uuid;
  v_step integer;
  v_member jsonb;
  v_event jsonb := jsonb_build_object('kind', 'hours_step', 'at', p_at, 'stake', null, 'tableId', null);
  v_stopped_at timestamptz;
begin
  select * into v_visit from public.visit v where v.id = p_visit_id;
  if v_visit.id is null then
    return;
  end if;
  -- Only versions the member is for (tier and audience; a play-time bonus counts its own stakes in the minutes), so a step
  -- no version would give is not weighed again each minute (review, 8 Nov).
  v_member := private.promotion_member_facts(v_visit.member_id);
  v_table := (select s.table_id from public.seat_session s where s.visit_id = p_visit_id
              order by s.ended_at is null desc, s.started_at desc limit 1);
  -- Frozen, promotions stopped or the member frozen (the owner, 9 Nov): the steps reached since the stop began are skipped
  -- for good, never paid once released.
  begin
    perform private.assert_writable(v_visit.venue_id, 'promotions', v_visit.member_id);
  exception when sqlstate 'RVKIL' or sqlstate 'RVFRZ' or sqlstate 'RVMBR' then
    -- When the stop began: the earliest of those in force, as private.assert_writable finds them.
    v_stopped_at := (select min(c.engaged_at) from public.control_state c
                     where c.venue_id = v_visit.venue_id and c.released_at is null
                       and (c.level = 'venue_freeze' or (c.level = 'feature_kill' and c.feature = 'promotions')
                            or (c.level = 'member_freeze' and c.member_id = v_visit.member_id)));
    insert into public.promotion_step_skip (venue_id, promotion_id, member_id, visit_id, step_number)
    select distinct v_visit.venue_id, pv.promotion_id, v_visit.member_id, p_visit_id, private.promo_step_key(pv.reward, s.o_after_minutes)
    from public.promotion_version pv
    cross join lateral private.visit_schedule_time_at(p_visit_id, pv.schedule, pv.eligibility, p_at) t
    cross join lateral private.visit_schedule_time_at(p_visit_id, pv.schedule, pv.eligibility, coalesce(v_stopped_at, p_at)) b
    cross join lateral private.promo_hours_steps(pv.reward) s
    where pv.venue_id = v_visit.venue_id and pv.status = 'live' and pv.reward ->> 'kind' = 'hours_bonus'
      and s.o_after_minutes <= t.o_seconds / 60 and s.o_after_minutes > b.o_seconds / 60
      and private.promo_is_eligible(jsonb_build_object('reward', pv.reward, 'eligibility', pv.eligibility, 'schedule', pv.schedule), v_member, v_event)
      and not private.promo_step_settled(pv.promotion_id, v_visit.member_id, p_visit_id, private.promo_step_key(pv.reward, s.o_after_minutes))
    on conflict do nothing;
    return;
  end;
  for v_step in
    select distinct s.o_after_minutes
    from public.promotion_version pv
    cross join lateral private.visit_schedule_time_at(p_visit_id, pv.schedule, pv.eligibility, p_at) t
    cross join lateral private.promo_hours_steps(pv.reward) s
    where pv.venue_id = v_visit.venue_id and pv.status = 'live' and pv.reward ->> 'kind' = 'hours_bonus' and s.o_after_minutes <= t.o_seconds / 60
      and private.promo_is_eligible(jsonb_build_object('reward', pv.reward, 'eligibility', pv.eligibility, 'schedule', pv.schedule), v_member, v_event)
      and not private.promo_step_settled(pv.promotion_id, v_visit.member_id, p_visit_id, private.promo_step_key(pv.reward, s.o_after_minutes))
    order by 1
  loop
    perform private.evaluate_promotions(v_visit.venue_id, 'hours_step', jsonb_build_object(
      'member_id', v_visit.member_id, 'table_id', v_table, 'visit_id', p_visit_id,
      'key', 'hours_step:' || p_visit_id || ':' || v_step, 'step_minutes', v_step, 'at', p_at));
  end loop;
end;
$$;
