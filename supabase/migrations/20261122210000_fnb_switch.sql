-- Food and drink on or off (the owner, 16 Nov 2026; decision 0681). A super admin switches F&B off for the venue: no new
-- order is taken, from a member's app, a dealer's tablet or the console, and the apps hide ordering. Orders already placed
-- are still served, and the F&B page and report stay. None set is on, as F&B has been. Only a super admin changes it, with a
-- reason, and the owner is alerted (private.guard_control_settings).

insert into public.setting_key (key, description, scope, value_schema) values
  ('fnb.enabled',
   'Food and drink: members, dealers and staff place orders. Off, no new order is taken anywhere, and orders already placed are still served. None set is on. Only a super admin changes it, with a reason.',
   'venue',
   '{"type":"object","properties":{"enabled":{"type":"boolean"}},"required":["enabled"],"additionalProperties":false}');

-- As 20261121120000_aadhaar_covers_setting.sql, with fnb.enabled a control setting too.
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap',
                                 'bonus.by_hand_cap', 'kyc.aadhaar_covers', 'fnb.enabled'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap',
                                 'bonus.by_hand_cap', 'kyc.aadhaar_covers', 'fnb.enabled'))
  execute function private.guard_control_settings();

-- Whether the venue takes food and drink orders now. None set is on.
create function private.fnb_on(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.setting_at(p_venue_id, 'fnb.enabled', '', now()) ->> 'enabled')::boolean, true);
$$;

-- The same for the apps: with no venue, the signed-in member's (the player app hides ordering); with one, that venue's, for
-- its staff and its dealer tablets. Whether a club serves food is no secret.
create function public.fnb_on(p_venue_id uuid default null)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.fnb_on(coalesce(p_venue_id, private.current_member_venue_id())); $$;
revoke execute on function private.fnb_on(uuid), public.fnb_on(uuid) from public, anon;
grant execute on function private.fnb_on(uuid), public.fnb_on(uuid) to authenticated;

-- No new order while F&B is off, whoever places it (place_fnb_order, tablet_fnb_order, console_fnb_order): refused before it
-- is kept, so an app opened before the switch takes none either.
create function private.refuse_fnb_order_while_off()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.fnb_on(new.venue_id) then
    raise exception 'Food and drink is off at this venue' using errcode = 'RVFNB';
  end if;
  return new;
end;
$$;
revoke execute on function private.refuse_fnb_order_while_off() from public;

create trigger fnb_order_while_off before insert on public.fnb_order
  for each row execute function private.refuse_fnb_order_while_off();

-- As 20261104300000_live_status.sql made it, with the lock screen's Order offered only while F&B is on. A status already on a
-- phone changes at the member's next seat event.
create or replace function private.live_status_of(p_member_id uuid)
returns table (state text, entry_id uuid, table_name text, seat integer, game text, place integer, starts_at timestamptz,
               ends_at timestamptz, can_order boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select x.state, x.entry_id, x.table_name, x.seat, x.game, x.place, x.starts_at, x.ends_at, x.can_order
  from (
    select 1 as rank, 'seated' as state, null::uuid as entry_id, g.name as table_name, s.seat, t.name as game, null::integer as place,
           ends.at - make_interval(mins => s.call_time_minutes) as starts_at, ends.at as ends_at,
           private.has_feature(s.member_id, 'fnb.table_side') and private.fnb_on(s.venue_id) as can_order
    from public.seat_session s
    join public.game_table g on g.id = s.table_id
    join public.table_type t on t.id = g.table_type_id
    cross join lateral (
      select case when s.call_time_minutes > 0 and s.away_since is null and s.call_time_completed_at is null
                       and private.has_feature(s.member_id, 'call_time.view')
                  then date_trunc('second', s.started_at + make_interval(mins => s.call_time_minutes, secs => s.away_seconds)) end as at
    ) ends
    where s.member_id = p_member_id and s.ended_at is null and private.wants_push(p_member_id, 'push.call_time_complete')
    union all
    select 2, case when held.is_held then 'seat_ready' else 'waiting' end, e.id,
           case when held.is_held then called.name else asked.name end, case when held.is_held then e.call_seat end, t.name, r.place,
           case when held.is_held then date_trunc('second', e.called_at) end, case when held.is_held then date_trunc('second', e.hold_until) end,
           false
    from public.waitlist_entry e
    join public.table_type t on t.id = e.table_type_id
    cross join lateral (select coalesce(e.called_at is not null and e.hold_until > now(), false) as is_held) held
    left join lateral private.ranked_waitlist(array[e.table_type_id]) r on r.entry_id = e.id
    left join public.game_table called on called.id = e.call_table_id
    left join public.game_table asked on asked.id = e.table_id
    where e.member_id = p_member_id and e.status = 'waiting' and e.joined_at >= private.tonight_began(now())
      and private.wants_push(p_member_id, 'push.seat_ready')
      and not exists (select 1 from public.seat_session s where s.member_id = p_member_id and s.ended_at is null)
  ) x
  order by x.rank, x.starts_at nulls last
  limit 1;
$$;
