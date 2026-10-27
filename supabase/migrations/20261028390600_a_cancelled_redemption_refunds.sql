-- A redemption not yet handed over can be cancelled, and the member gets back what it took (#462): the points or nights
-- return by reversing its ledger transaction, the reward's stock goes back up, and the cancel is audited with its
-- reason. Whoever hands rewards over cancels them (rewards.hand_over), as when the desk has run out or the member changes
-- their mind. A cancelled redemption is never handed over and leaves both lists. Redemptions switched off stop cancels too.
alter table public.redemption
  add column cancelled_at timestamptz,
  add column cancelled_by_staff_id uuid,
  add column cancel_reason text check (length(cancel_reason) between 3 and 300),
  add foreign key (cancelled_by_staff_id, venue_id) references public.staff (id, venue_id),
  add check ((cancelled_at is null) = (cancelled_by_staff_id is null) and (cancelled_at is null) = (cancel_reason is null)),
  add check (cancelled_at is null or handed_over_at is null);

create function private.cancel_redemption(p_redemption_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_redemption public.redemption;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into v_redemption from public.redemption r where r.id = p_redemption_id for update;
  if v_redemption.id is null or not private.has_permission(v_redemption.venue_id, 'rewards.hand_over') then
    raise exception 'Only rewards.hand_over cancels a redemption' using errcode = '42501';
  end if;
  if v_redemption.cancelled_at is not null then
    return;
  end if;
  if v_redemption.handed_over_at is not null then
    raise exception 'That redemption was handed over already' using errcode = 'RVHND';
  end if;
  if length(v_reason) not between 3 and 300 then
    raise exception 'A reason of 3 to 300 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(v_redemption.venue_id, 'redemptions', v_redemption.member_id);
  perform private.reverse_ledger_transaction(v_redemption.ledger_transaction_id, 'redemption_cancel:' || v_redemption.id::text,
                                             'Redemption cancelled: ' || v_reason);
  update public.reward_item set stock = stock + 1 where id = v_redemption.reward_item_id and stock is not null;
  update public.redemption
  set cancelled_at = now(), cancelled_by_staff_id = private.current_staff_id(v_redemption.venue_id), cancel_reason = v_reason
  where id = v_redemption.id;
  perform private.audit(v_redemption.venue_id, 'redemption.cancel', 'redemption', v_redemption.id::text, null, null, v_reason);
  perform private.emit(v_redemption.venue_id, 'reward.redemption_cancelled',
                       jsonb_build_object('redemption_id', v_redemption.id, 'member_id', v_redemption.member_id),
                       'reward.redemption_cancelled:' || v_redemption.id);
end;
$$;

create function public.cancel_redemption(p_redemption_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.cancel_redemption(p_redemption_id, p_reason); $$;

revoke execute on function private.cancel_redemption(uuid, text), public.cancel_redemption(uuid, text) from public, anon;
grant execute on function private.cancel_redemption(uuid, text), public.cancel_redemption(uuid, text) to authenticated;

-- As before (20261028390500_redemptions_follow_the_kill_switch.sql), refusing a cancelled redemption.
create or replace function private.hand_over_redemption(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_redemption public.redemption;
begin
  select * into v_redemption from public.redemption r where r.id = p_redemption_id for update;
  if v_redemption.id is null or not private.has_permission(v_redemption.venue_id, 'rewards.hand_over') then
    raise exception 'Only rewards.hand_over hands over a redemption' using errcode = '42501';
  end if;
  if v_redemption.cancelled_at is not null then
    raise exception 'That redemption was cancelled' using errcode = 'RVCNL';
  end if;
  if v_redemption.handed_over_at is not null then
    raise exception 'That redemption was handed over already' using errcode = 'RVHND';
  end if;
  perform private.assert_writable(v_redemption.venue_id, 'redemptions', v_redemption.member_id);
  update public.redemption set handed_over_at = now(), handed_over_by_staff_id = private.current_staff_id(v_redemption.venue_id)
  where id = v_redemption.id;
end;
$$;

-- As before (20261028380200_hotel_nights_catalogue.sql), without cancelled redemptions.
create or replace function private.venue_redemptions(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, reward_name text, kind text, points bigint, nights integer,
               created_at timestamptz, handed_over_at timestamptz, handed_over_by text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, m.id, m.full_name, m.member_number, i.name, i.kind, r.points, r.nights, r.created_at, r.handed_over_at, s.full_name
  from public.redemption r
  join public.member m on m.id = r.member_id
  join public.reward_item i on i.id = r.reward_item_id
  left join public.staff s on s.id = r.handed_over_by_staff_id
  where r.venue_id = p_venue_id and private.has_permission(p_venue_id, 'rewards.hand_over') and r.cancelled_at is null
    and (r.handed_over_at is null or r.handed_over_at > now() - interval '30 days')
  order by r.handed_over_at is null desc, case when r.handed_over_at is null then r.created_at end, r.handed_over_at desc
  limit 500;
$$;

create or replace function private.my_redemptions()
returns table (id uuid, reward_name text, kind text, detail text, points bigint, nights integer, created_at timestamptz, handed_over_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, i.name, i.kind, i.detail, r.points, r.nights, r.created_at, r.handed_over_at
  from public.redemption r join public.reward_item i on i.id = r.reward_item_id
  where r.member_id = private.current_member_id() and private.has_feature(r.member_id, 'rewards.catalogue') and r.cancelled_at is null
  order by r.created_at desc
  limit 20;
$$;

-- A member's export (#498) lists the new columns: when and by whom, as a hand-over is; the reason is a staff note.
insert into private.member_export_column (table_name, column_name, kind) values
  ('redemption', 'cancelled_at', 'owed'), ('redemption', 'cancelled_by_staff_id', 'owed'), ('redemption', 'cancel_reason', 'note');

-- redemption gained columns without a default: the practice venue's seed is taken again (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
