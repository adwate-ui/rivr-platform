-- The host queue (#165; decision 0276): lapsed regulars, found from gaps in their visits, for hosts to win back. Each
-- club day a sweep queues a member who came at least `visits` times in the six months before and not for `days` days
-- (setting host.lapse; none set is 3 and 21), once for each lapse. A host records why the player stopped coming and the
-- offer made, as one of the promotion engine's own effects (promotionEffectSchema), and closes the item; the player's
-- next visit closes it as won back. Never a player on a break or back from one since their last visit, never one without
-- marketing consent (an offer is marketing, under DPDP), never one frozen or at a frozen venue, never at the practice
-- venue; a break taken later closes their item. Staff with members.manage. Erasure deletes a member's items.

insert into public.setting_key (key, description, scope, value_schema) values
  ('host.lapse',
   'When a regular has lapsed, for the host queue: at least this many visits in the six months before, and none for this many days; none set is 3 and 21.',
   'venue',
   '{"type":"object","properties":{"visits":{"type":"integer","minimum":1,"maximum":100},"days":{"type":"integer","minimum":7,"maximum":365}},"required":["visits","days"],"additionalProperties":false}');

create table public.host_queue_item (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  -- The lapse: the last visit before it, and the visits in the six months before that sweep.
  last_visit_at timestamptz not null,
  visits integer not null check (visits >= 1),
  status text not null default 'open' check (status in ('open', 'offered', 'won_back', 'closed')),
  churn_reason text check (churn_reason is null or churn_reason in ('moved_away', 'busy', 'budget', 'game_too_big', 'game_too_small', 'bad_experience', 'playing_elsewhere', 'unreachable', 'other')),
  -- The offer made, as a promotion effect (@rivr/contracts promotionEffectSchema).
  offer jsonb check (offer is null or private.is_promotion_rule('{}', offer)),
  note text check (note is null or length(btrim(note)) between 1 and 500),
  handled_by_staff_id uuid,
  handled_at timestamptz,
  won_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (handled_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((status = 'won_back') = (won_back_at is not null)),
  check ((handled_at is null) = (handled_by_staff_id is null))
);

comment on table public.host_queue_item is 'A lapsed regular for a host to call (#165): the lapse, why they stopped coming, the offer made, and how it ended.';

create unique index host_queue_item_open_idx on public.host_queue_item (member_id) where status in ('open', 'offered');
create index host_queue_item_venue_idx on public.host_queue_item (venue_id, status);
create index host_queue_item_staff_idx on public.host_queue_item (handled_by_staff_id, venue_id);
create trigger host_queue_item_touch_updated_at before update on public.host_queue_item
  for each row execute function private.touch_updated_at();

-- Read and changed through the functions below only.
alter table public.host_queue_item enable row level security;
revoke all on public.host_queue_item from anon, authenticated;

-- The host's words, the reason and the note, are staff notes about the member (decision 0240); the rest is owed.
insert into private.member_export_column (table_name, column_name, kind)
select 'host_queue_item', c.column_name, case when c.column_name in ('churn_reason', 'note') then 'note' else 'owed' end
from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'host_queue_item';

-- Whether a host may call the member now: not on a break, and with marketing consent in force.
create function private.host_may_call(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_consent(p_member_id, 'marketing')
    and not exists (select 1 from public.self_exclusion s where s.member_id = p_member_id and s.ends_at > now());
$$;

-- The day's sweep (pg_cron, 06:00 IST): each lapsed regular, once for each lapse.
create function private.queue_lapsed_players()
returns integer
language sql
security definer
set search_path = ''
as $$
  with lapse as (
    select v.venue_id, v.member_id, max(v.opened_at) as last_at, count(*)::integer as visits,
           coalesce((private.setting_at(v.venue_id, 'host.lapse', '', now()) ->> 'visits')::integer, 3) as needs,
           coalesce((private.setting_at(v.venue_id, 'host.lapse', '', now()) ->> 'days')::integer, 21) as days
    from public.visit v
    join public.venue ve on ve.id = v.venue_id and not ve.is_practice
    join public.member m on m.id = v.member_id and m.erased_at is null
    where v.opened_at > now() - interval '6 months'
    group by v.venue_id, v.member_id
  ), queued as (
    insert into public.host_queue_item (venue_id, member_id, last_visit_at, visits)
    select l.venue_id, l.member_id, l.last_at, l.visits
    from lapse l
    where l.visits >= l.needs and l.last_at < now() - make_interval(days => l.days)
      and not exists (select 1 from public.host_queue_item h where h.member_id = l.member_id and h.last_visit_at >= l.last_at)
      -- Not on a break now, nor back from one since the last visit: the break is the gap, not a lapse.
      and not exists (select 1 from public.self_exclusion s where s.member_id = l.member_id and s.ends_at > l.last_at)
      and private.host_may_call(l.member_id)
      and not exists (select 1 from public.control_state c
                      where c.released_at is null
                        and ((c.venue_id = l.venue_id and c.level = 'venue_freeze') or (c.member_id = l.member_id and c.level = 'member_freeze')))
    on conflict (member_id) where status in ('open', 'offered') do nothing
    returning 1
  )
  select count(*)::integer from queued;
$$;

-- A player who comes back is won back.
create function private.win_back_host_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.host_queue_item h set status = 'won_back', won_back_at = now()
  where h.member_id = new.member_id and h.status in ('open', 'offered');
  return null;
end;
$$;

create trigger visit_wins_back_host_item after insert on public.visit
  for each row execute function private.win_back_host_item();

-- A player who takes a break leaves the queue: nobody calls them with an offer.
create function private.close_host_item_on_break()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.host_queue_item h set status = 'closed' where h.member_id = new.member_id and h.status in ('open', 'offered');
  return null;
end;
$$;

create trigger self_exclusion_closes_host_item after insert on public.self_exclusion
  for each row execute function private.close_host_item_on_break();

-- The venue's lapsed regulars not yet won back or closed, and a host may call now, longest lapsed first, for staff with
-- members.manage.
create function private.host_queue(p_venue_id uuid)
returns table (item_id uuid, member_id uuid, full_name text, phone text, last_visit_at timestamptz, visits integer, status text,
               churn_reason text, offer jsonb, note text, handled_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, m.id, m.full_name, m.phone, h.last_visit_at, h.visits, h.status, h.churn_reason, h.offer, h.note, h.handled_at
  from public.host_queue_item h
  join public.member m on m.id = h.member_id
  where h.venue_id = p_venue_id and h.status in ('open', 'offered') and private.has_permission(p_venue_id, 'members.manage')
    and private.host_may_call(h.member_id)
  order by h.last_visit_at, h.id;
$$;

-- The host's call: why the player stopped coming, the offer made (none keeps it open), and a note.
create function private.record_host_contact(p_item_id uuid, p_churn_reason text, p_offer jsonb, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.host_queue_item;
begin
  select * into v_item from public.host_queue_item h where h.id = p_item_id for update;
  if v_item.id is null or not private.has_permission(v_item.venue_id, 'members.manage') then
    raise exception 'Only a host at the venue records a call' using errcode = '42501';
  end if;
  perform private.assert_writable(v_item.venue_id);
  if v_item.status not in ('open', 'offered') or not private.host_may_call(v_item.member_id) then
    raise exception 'This player is no longer in the queue' using errcode = 'RVHST';
  end if;
  if p_churn_reason is null or p_churn_reason not in ('moved_away', 'busy', 'budget', 'game_too_big', 'game_too_small', 'bad_experience', 'playing_elsewhere', 'unreachable', 'other') then
    raise exception 'A reason the player stopped coming' using errcode = '22023';
  end if;
  update public.host_queue_item h
  set churn_reason = p_churn_reason, offer = p_offer, note = nullif(btrim(p_note), ''),
      status = case when p_offer is null then 'open' else 'offered' end,
      handled_by_staff_id = private.current_staff_id(v_item.venue_id), handled_at = now()
  where h.id = p_item_id;
end;
$$;

-- The host is done with a player: closed, whether or not they come back.
create function private.close_host_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.host_queue_item;
begin
  select * into v_item from public.host_queue_item h where h.id = p_item_id for update;
  if v_item.id is null or not private.has_permission(v_item.venue_id, 'members.manage') then
    raise exception 'Only a host at the venue closes a call' using errcode = '42501';
  end if;
  perform private.assert_writable(v_item.venue_id);
  update public.host_queue_item h
  set status = 'closed', handled_by_staff_id = private.current_staff_id(v_item.venue_id), handled_at = now()
  where h.id = p_item_id and h.status in ('open', 'offered');
end;
$$;

-- As 20261028395100_learn_lessons.sql made it, deleting the member's host queue items too.
create or replace function private.delete_member_records(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_preference x where x.member_id = p_member.id;
  delete from public.notification_preference x where x.member_id = p_member.id;
  delete from public.member_limit x where x.member_id = p_member.id;
  delete from public.member_feature_override x where x.member_id = p_member.id;
  delete from public.sign_up_attribution x where x.member_id = p_member.id;
  delete from public.membership_card x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.review_request x where x.member_id = p_member.id;
  delete from public.cab_request x where x.member_id = p_member.id;
  delete from public.club_event_booking x where x.member_id = p_member.id;
  delete from public.learn_attempt x where x.member_id = p_member.id;
  delete from public.learn_card x where x.member_id = p_member.id;
  delete from public.learn_session x where x.member_id = p_member.id;
  delete from public.inbox_message x where x.lead_id in (select l.id from public.lead l where l.member_id = p_member.id);
  delete from public.lead x where x.member_id = p_member.id;
  delete from public.push_subscription x where x.member_id = p_member.id;
  delete from public.winner_card x where x.member_id = p_member.id;
  delete from public.learn_lesson x where x.member_id = p_member.id;
  delete from public.host_queue_item x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;

create function public.host_queue(p_venue_id uuid)
returns table (item_id uuid, member_id uuid, full_name text, phone text, last_visit_at timestamptz, visits integer, status text,
               churn_reason text, offer jsonb, note text, handled_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.host_queue(p_venue_id); $$;
create function public.record_host_contact(p_item_id uuid, p_churn_reason text, p_offer jsonb default null, p_note text default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_host_contact(p_item_id, p_churn_reason, p_offer, p_note); $$;
create function public.close_host_item(p_item_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.close_host_item(p_item_id); $$;

revoke execute on function private.queue_lapsed_players(), private.win_back_host_item(), private.host_queue(uuid),
  private.record_host_contact(uuid, text, jsonb, text), private.close_host_item(uuid), public.host_queue(uuid),
  public.record_host_contact(uuid, text, jsonb, text), public.close_host_item(uuid) from public, anon;
revoke execute on function private.queue_lapsed_players(), private.win_back_host_item(), private.close_host_item_on_break(), private.host_may_call(uuid)
  from public, anon, authenticated;
grant execute on function private.host_queue(uuid), private.record_host_contact(uuid, text, jsonb, text), private.close_host_item(uuid),
  public.host_queue(uuid), public.record_host_contact(uuid, text, jsonb, text), public.close_host_item(uuid) to authenticated;

select cron.schedule('host-queue', '30 0 * * *', 'select private.queue_lapsed_players()');
