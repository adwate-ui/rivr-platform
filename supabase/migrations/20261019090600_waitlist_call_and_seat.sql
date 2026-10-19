-- Call, seat and step away (#63, scope-v1 module 2, design prompt flow 1). The floor calls the member
-- at the top of a list to a table and seat: they hold it for waitlist.hold_minutes (20), and
-- waitlist.called sends the seat call. Seat takes the place off every list. A call unanswered when
-- its hold runs out, left, or skipped by the floor rolls to the next name. A member who steps away
-- (or whom the floor skips) keeps their place for the same time in all, however often they step away,
-- and no longer. A called place is still waiting: status 'waiting' with called_at set, so every list
-- and count already holds it until it is seated or let go. One seat is held for one call at a time.
-- Nothing runs out while the venue is frozen: holds and time away pause (question #286).
--
-- Refusals the apps tell apart: RVHLD the seat is held for another call; RVLAT the hold or the time
-- away has run out; RVAWY no time away is left for this place.

insert into public.setting_key (key, description, scope, value_schema) values
  ('waitlist.hold_minutes',
   'How long a called seat is held, and how long a member who steps away keeps their place, in minutes (scope-v1 module 2).',
   'venue',
   '{"type":"object","properties":{"minutes":{"type":"integer","minimum":1,"maximum":120}},"required":["minutes"],"additionalProperties":false}');

alter table public.waitlist_entry drop constraint waitlist_entry_status_check;
alter table public.waitlist_entry add constraint waitlist_entry_status_check check (status in ('waiting', 'seated', 'left'));
alter table public.waitlist_entry
  add column called_at timestamptz,
  add column hold_until timestamptz,
  add column call_table_id uuid,
  add column call_seat integer check (call_seat between 1 and 10),
  add column seated_at timestamptz,
  add column stepped_away_at timestamptz,
  -- Time away already used by this place, before the current step away if any.
  add column away_used interval not null default interval '0' check (away_used >= interval '0'),
  -- Why a place came off a list: left (the member or the floor), missed (a call unanswered), stepped_away (not back in time).
  add column left_reason text check (left_reason in ('left', 'missed', 'stepped_away')),
  add constraint waitlist_entry_call_table_fkey foreign key (call_table_id, venue_id) references public.game_table (id, venue_id),
  add constraint waitlist_entry_called check ((called_at is null) = (hold_until is null) and (called_at is null) = (call_table_id is null)
                                              and (called_at is null) = (call_seat is null)),
  add constraint waitlist_entry_seated check ((status = 'seated') = (seated_at is not null) and (status <> 'seated' or called_at is not null));

update public.waitlist_entry set left_reason = 'left' where status = 'left';
alter table public.waitlist_entry add constraint waitlist_entry_left_reason check ((status = 'left') = (left_reason is not null));

create index waitlist_entry_call_table_idx on public.waitlist_entry (call_table_id);
create index waitlist_entry_hold_idx on public.waitlist_entry (hold_until) where status = 'waiting' and called_at is not null;
create unique index waitlist_entry_held_seat_idx on public.waitlist_entry (call_table_id, call_seat) where status = 'waiting' and called_at is not null;

-- The hold, in force at `p_at`; 20 minutes where the venue has not set it.
create function private.waitlist_hold(p_venue_id uuid, p_at timestamptz)
returns interval
language sql
stable
security definer
set search_path = ''
as $$
  select make_interval(mins => coalesce((private.setting_at(p_venue_id, 'waitlist.hold_minutes', '', p_at) ->> 'minutes')::integer, 20));
$$;

-- When a place that stepped away at `p_stepped_away_at` goes: the hold, less the time away it used before.
create function private.away_until(p_venue_id uuid, p_stepped_away_at timestamptz, p_away_used interval)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select p_stepped_away_at + private.waitlist_hold(p_venue_id, p_stepped_away_at) - p_away_used;
$$;

-- Calls a waiting place to a table and seat: the hold starts now, and waitlist.called sends the seat
-- call. Shared by the floor's Call and the roll-on. Not while the venue or the member is frozen, and
-- not to a seat another call holds.
create function private.put_call(p_entry_id uuid, p_table_id uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
  v_table public.game_table;
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id for update;
  select * into v_table from public.game_table t where t.id = p_table_id;
  if v_entry.status is distinct from 'waiting' or v_entry.called_at is not null or v_entry.stepped_away_at is not null
     or v_table.id is null or v_table.table_type_id <> v_entry.table_type_id or not v_table.is_open
     or p_seat is null or p_seat not between 1 and v_table.seats then
    raise exception 'Call a waiting member to an open table of their game, and a seat at it' using errcode = '22023';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, v_entry.member_id);
  -- Nobody reaches a seat without a finished identity check (scope-v1 module 1).
  if not private.is_kyc_complete(v_entry.member_id) then
    raise exception 'Finish the identity check to take a seat' using errcode = 'RVKYC';
  end if;
  if exists (select 1 from public.waitlist_entry e
             where e.call_table_id = v_table.id and e.call_seat = p_seat and e.status = 'waiting' and e.called_at is not null) then
    raise exception 'That seat is held for someone already called' using errcode = 'RVHLD';
  end if;
  begin
    update public.waitlist_entry
    set called_at = now(), hold_until = now() + private.waitlist_hold(v_entry.venue_id, now()), call_table_id = v_table.id, call_seat = p_seat
    where id = v_entry.id
    returning * into v_entry;
  exception when unique_violation then
    -- Another call took the seat at the same moment.
    raise exception 'That seat is held for someone already called' using errcode = 'RVHLD';
  end;
  perform private.emit(v_entry.venue_id, 'waitlist.called',
                       jsonb_build_object('entry_id', v_entry.id, 'member_id', v_entry.member_id, 'table_name', v_table.name,
                                          'seat', p_seat, 'hold_until', v_entry.hold_until),
                       'waitlist.called:' || v_entry.id || ':' || v_entry.called_at);
end;
$$;

-- The floor calls a member (waitlist.manage).
create function private.call_from_waitlist(p_entry_id uuid, p_table_id uuid, p_seat integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select e.venue_id from public.waitlist_entry e where e.id = p_entry_id);
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'waitlist.manage') then
    raise exception 'Only the floor calls a member' using errcode = '42501';
  end if;
  perform private.put_call(p_entry_id, p_table_id, p_seat);
end;
$$;

-- The floor seats a called member at the table and seat they were called to, while the hold lasts
-- and the table is open; the place comes off every list.
create function private.seat_from_waitlist(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id for update;
  if v_entry.id is null or not private.has_permission(v_entry.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor seats a member' using errcode = '42501';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, v_entry.member_id);
  if v_entry.status <> 'waiting' or v_entry.called_at is null
     or not exists (select 1 from public.game_table t where t.id = v_entry.call_table_id and t.is_open) then
    raise exception 'Seat a member who has been called, at a table still open' using errcode = '22023';
  end if;
  if v_entry.hold_until <= now() then
    raise exception 'The hold has run out' using errcode = 'RVLAT';
  end if;
  if not private.is_kyc_complete(v_entry.member_id) then
    raise exception 'Finish the identity check to take a seat' using errcode = 'RVKYC';
  end if;
  update public.waitlist_entry set status = 'seated', seated_at = now() where id = v_entry.id;
  perform private.emit(v_entry.venue_id, 'seat.taken',
                       jsonb_build_object('entry_id', v_entry.id, 'member_id', v_entry.member_id, 'table_id', v_entry.call_table_id,
                                          'seat', v_entry.call_seat),
                       'seat.taken:' || v_entry.id);
end;
$$;

-- The roll-on of a call that ended unseated: the next name on the list, not called and not away, is
-- called to the same seat; one who is frozen or has no finished check is passed over. Nobody is called
-- while the venue is frozen, or if the seat is held for another call by then.
create function private.roll_call_on(p_ended public.waitlist_entry)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next record;
begin
  for v_next in
    select r.entry_id
    from private.ranked_waitlist(array[p_ended.table_type_id]) r
    join public.waitlist_entry e on e.id = r.entry_id
    where e.called_at is null and e.stepped_away_at is null
    order by r.place
  loop
    begin
      perform private.put_call(v_next.entry_id, p_ended.call_table_id, p_ended.call_seat);
      return;
    exception when sqlstate 'RVFRZ' or sqlstate 'RVHLD' then
      return;
    when sqlstate 'RVMBR' or sqlstate 'RVKYC' or sqlstate '22023' then
      -- A frozen member, one without a finished check, or a table closed since the call: try the next.
      continue;
    end;
  end loop;
end;
$$;

-- Steps a waiting place away or back: the member their own, or the floor anyone's (Skip and Back).
-- Away, the place is kept for the hold, counted once however often it steps away; back in time, it
-- is as before; else it comes off the list. Not while the venue or the member is frozen (decision
-- 0044). A member who is called cannot step away; the floor's Skip ends the call, keeps the place as
-- away, and calls the next name to the seat.
create function private.step_away(p_entry_id uuid, p_is_away boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
  v_member_id uuid := private.current_member_id();
  v_is_floor boolean;
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id for update;
  if v_entry.id is null then
    raise exception 'Only the member or the floor steps a place away' using errcode = '42501';
  end if;
  v_is_floor := v_member_id is null or v_entry.member_id <> v_member_id;
  if v_is_floor and not private.has_permission(v_entry.venue_id, 'waitlist.manage') then
    raise exception 'Only the member or the floor steps a place away' using errcode = '42501';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, case when v_is_floor then null else v_entry.member_id end);
  if v_entry.status <> 'waiting' or (v_entry.called_at is not null and not (v_is_floor and p_is_away)) then
    raise exception 'Only a waiting place steps away, and a called one only when the floor skips it' using errcode = '22023';
  end if;
  if v_entry.called_at is not null then
    update public.waitlist_entry
    set called_at = null, hold_until = null, call_table_id = null, call_seat = null, stepped_away_at = now()
    where id = v_entry.id;
    perform private.roll_call_on(v_entry);
  elsif p_is_away and v_entry.stepped_away_at is null then
    if v_entry.away_used >= private.waitlist_hold(v_entry.venue_id, now()) then
      raise exception 'No time away is left for this place' using errcode = 'RVAWY';
    end if;
    update public.waitlist_entry set stepped_away_at = now() where id = v_entry.id;
  elsif not p_is_away and v_entry.stepped_away_at is not null then
    if private.away_until(v_entry.venue_id, v_entry.stepped_away_at, v_entry.away_used) <= now() then
      raise exception 'Away too long: the place has gone' using errcode = 'RVLAT';
    end if;
    update public.waitlist_entry
    -- A pause for a freeze can put stepped_away_at a moment ahead: that counts as no time.
    set away_used = away_used + greatest(now() - stepped_away_at, interval '0'), stepped_away_at = null
    where id = v_entry.id;
  end if;
end;
$$;

-- Every minute (pg_cron): a call unanswered when its hold ran out comes off the list and rolls to the
-- next name; a member away past their time comes off the list. At a frozen venue nothing runs out:
-- holds and time away pause, each minute frozen moving them on a minute, so nobody loses a place to a
-- freeze (question #286).
create function private.expire_waitlist_holds()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missed public.waitlist_entry;
begin
  update public.waitlist_entry e
  set hold_until = e.hold_until + interval '1 minute', stepped_away_at = e.stepped_away_at + interval '1 minute'
  where e.status = 'waiting' and (e.called_at is not null or e.stepped_away_at is not null)
    and exists (select 1 from public.control_state c
                where c.venue_id = e.venue_id and c.level = 'venue_freeze' and c.released_at is null);
  update public.waitlist_entry e
  set status = 'left', left_at = now(), left_reason = 'stepped_away'
  where e.status = 'waiting' and e.stepped_away_at is not null
    and private.away_until(e.venue_id, e.stepped_away_at, e.away_used) <= now()
    and not exists (select 1 from public.control_state c
                    where c.venue_id = e.venue_id and c.level = 'venue_freeze' and c.released_at is null);
  for v_missed in
    update public.waitlist_entry e
    set status = 'left', left_at = now(), left_reason = 'missed'
    where e.status = 'waiting' and e.called_at is not null and e.hold_until <= now()
      and not exists (select 1 from public.control_state c
                      where c.venue_id = e.venue_id and c.level = 'venue_freeze' and c.released_at is null)
    returning e.*
  loop
    perform private.roll_call_on(v_missed);
  end loop;
end;
$$;

revoke execute on function private.waitlist_hold(uuid, timestamptz), private.away_until(uuid, timestamptz, interval),
  private.put_call(uuid, uuid, integer),
  private.roll_call_on(public.waitlist_entry), private.expire_waitlist_holds() from public, anon, authenticated;
grant execute on function private.call_from_waitlist(uuid, uuid, integer), private.seat_from_waitlist(uuid),
  private.step_away(uuid, boolean) to authenticated;

select cron.schedule('waitlist-holds', '* * * * *', 'select private.expire_waitlist_holds()');

-- Leaving records why: the member or the floor took the place off. A called place that leaves rolls
-- its seat to the next name.
create or replace function private.leave_waitlist(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
  v_member_id uuid := private.current_member_id();
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id for update;
  if v_entry.id is null then
    raise exception 'Only the member or the floor takes a place off a waitlist' using errcode = '42501';
  end if;
  if v_member_id is null or v_entry.member_id <> v_member_id then
    if not private.has_permission(v_entry.venue_id, 'waitlist.manage') then
      raise exception 'Only the member or the floor takes a place off a waitlist' using errcode = '42501';
    end if;
    perform private.assert_writable(v_entry.venue_id);
  end if;
  if v_entry.status <> 'waiting' then return; end if;
  update public.waitlist_entry set status = 'left', left_at = now(), left_reason = 'left' where id = v_entry.id;
  if v_entry.called_at is not null then perform private.roll_call_on(v_entry); end if;
end;
$$;

-- The member's places now also say when they are called (table, seat, hold) or away (back by).
drop function public.my_waitlist();
drop function private.my_waitlist();

create function private.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.entry_id, t.id, t.name, t.small_blind_paise, t.big_blind_paise, r.joined_at, r.place, ct.name, e.call_seat, e.hold_until,
         private.away_until(e.venue_id, e.stepped_away_at, e.away_used)
  from private.ranked_waitlist(array(
         select x.table_type_id from public.waitlist_entry x
         where x.member_id = private.current_member_id() and x.status = 'waiting')) r
  join public.waitlist_entry e on e.id = r.entry_id
  join public.table_type t on t.id = r.table_type_id
  left join public.game_table ct on ct.id = e.call_table_id
  where r.member_id = private.current_member_id()
  order by r.joined_at;
$$;

grant execute on function private.my_waitlist() to authenticated;

create function public.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz)
language sql security invoker set search_path = ''
as $$ select * from private.my_waitlist(); $$;

grant execute on function public.my_waitlist() to authenticated;

-- The floor's lists now also say who is called (table, seat, hold) and who is away (back by).
drop function public.waitlist_board(uuid);
drop function private.waitlist_board(uuid);

create function private.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean, priority_reason text, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.entry_id, r.table_type_id, m.id, m.full_name, r.joined_at, r.place, r.added_by_staff_id is not null, r.priority_reason,
         ct.name, e.call_seat, e.hold_until, private.away_until(e.venue_id, e.stepped_away_at, e.away_used)
  from private.ranked_waitlist(array(select t.id from public.table_type t where t.venue_id = p_venue_id)) r
  join public.waitlist_entry e on e.id = r.entry_id
  join public.member m on m.id = r.member_id
  left join public.game_table ct on ct.id = e.call_table_id
  where private.has_permission(p_venue_id, 'waitlist.manage')
  order by r.table_type_id, r.place;
$$;

grant execute on function private.waitlist_board(uuid) to authenticated;

create function public.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean, priority_reason text, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz)
language sql security invoker set search_path = ''
as $$ select * from private.waitlist_board(p_venue_id); $$;

grant execute on function public.waitlist_board(uuid) to authenticated;

create function public.call_from_waitlist(p_entry_id uuid, p_table_id uuid, p_seat integer)
returns void language sql security invoker set search_path = ''
as $$ select private.call_from_waitlist(p_entry_id, p_table_id, p_seat); $$;

create function public.seat_from_waitlist(p_entry_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.seat_from_waitlist(p_entry_id); $$;

create function public.step_away(p_entry_id uuid, p_is_away boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.step_away(p_entry_id, p_is_away); $$;

grant execute on function public.call_from_waitlist(uuid, uuid, integer), public.seat_from_waitlist(uuid),
  public.step_away(uuid, boolean) to authenticated;
