-- One waitlist per table (owner, #777; console v3 Phase 3; decision 0433, which replaces 0321's list per stake). Each
-- table has its own list, with its own order and priority: a place is on its table's list (waitlist_entry.table_id), and
-- the stake (table_type_id) stays for priority, events and the website's counts. The member joins a chosen table's list;
-- the floor adds to a table's list, and calls and assigns a place only to its own table; the TV shows a list per table.

-- Every waiting place moves to the busiest active table of its stake: the most seated now, then the first in floor order,
-- then the table it was called to or asked for. A stake with no active table keeps its places on its first table in floor
-- order; a place whose stake has no table at all has no list left, and leaves it (decision 0433).
update public.waitlist_entry e
set table_id = (
  select g.id from public.game_table g
  where g.table_type_id = e.table_type_id and g.venue_id = e.venue_id
  order by g.active desc, g.deleted_at is null desc,
           (select count(*) from public.seat_session s where s.table_id = g.id and s.ended_at is null) desc,
           g.position, g.id = e.call_table_id desc, g.id = e.table_id desc, g.id
  limit 1)
where e.status = 'waiting';
update public.waitlist_entry e set status = 'left', left_at = now(), left_reason = 'left'
where e.status = 'waiting' and e.table_id is null;

alter table public.waitlist_entry
  drop constraint waitlist_entry_table_id_fkey,
  add constraint waitlist_entry_table_fkey foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  add constraint waitlist_entry_waits_at_a_table check (status <> 'waiting' or table_id is not null);
create index waitlist_entry_table_list_idx on public.waitlist_entry (table_id, joined_at) where status = 'waiting';
comment on column public.waitlist_entry.table_id is 'The table whose list the place is on (decision 0433); before 7 Nov 2026, the table asked for.';

-- Ranked a table at a time: by the priority weight of the place's stake, then join time. As 20261101150000_night_ends_clean.sql
-- made it, partitioned by the table and saying which. Callers still pass the stakes whose tables they read.
drop function private.ranked_waitlist(uuid[]);
create function private.ranked_waitlist(p_table_type_ids uuid[])
returns table (entry_id uuid, table_type_id uuid, member_id uuid, joined_at timestamptz, added_by_staff_id uuid,
               place integer, priority_reason text, table_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.table_type_id, e.member_id, e.joined_at, e.added_by_staff_id,
         row_number() over (partition by e.table_id order by coalesce(p.weight, 0) desc, e.joined_at, e.id)::integer,
         p.reason, e.table_id
  from public.waitlist_entry e
  left join lateral private.place_priority(e.member_id, e.table_type_id, e.joined_at) p on true
  where e.status = 'waiting' and e.approved_at is not null and e.table_type_id = any (p_table_type_ids)
    and e.joined_at >= private.tonight_began(now());
$$;
revoke execute on function private.ranked_waitlist(uuid[]) from public, anon, authenticated;

-- Joining is at a table, so the stake's join goes: an old player build is told the join is unavailable.
drop function public.join_waitlist(uuid, uuid);
drop function private.join_waitlist(uuid, uuid);

-- Puts a member on an active table's list at their venue. As 20261029180000_waitlist_requests.sql made it, by table: a
-- request id replays only its own table's place; the floor adding a member whose request waits at that table approves it;
-- waiting at another table is RVONE (the floor removes and adds to switch). Refusals otherwise as before; 22023 no such
-- active table at the member's venue.
drop function private.put_on_waitlist(uuid, uuid, uuid, uuid);
create function private.put_on_waitlist(p_member_id uuid, p_table_id uuid, p_idempotency_key uuid, p_staff_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_table public.game_table;
  v_id uuid;
  v_place public.waitlist_entry;
  v_replay public.waitlist_entry;
begin
  select * into v_replay from public.waitlist_entry e where e.venue_id = v_venue_id and e.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.member_id <> p_member_id or v_replay.table_id is distinct from p_table_id then
      raise exception 'That request id was used for another place' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  -- Held against the table being deactivated or deleted meanwhile (decision 0432).
  select * into v_table from public.game_table g where g.id = p_table_id and g.venue_id = v_venue_id and g.active for key share;
  if v_table.id is null then
    raise exception 'No such table at this venue' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id, null, p_member_id);
  -- One at a time per member with start_break (#56).
  perform 1 from public.member m where m.id = p_member_id for update;
  if not private.is_kyc_complete(p_member_id) then
    raise exception 'Finish the identity check to join a waitlist' using errcode = 'RVKYC';
  end if;
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: waitlists are closed until it ends' using errcode = 'RVBRK';
  end if;
  select * into v_place from public.waitlist_entry e where e.member_id = p_member_id and e.status = 'waiting';
  if v_place.table_id = v_table.id then
    if p_staff_id is not null and v_place.approved_at is null then
      update public.waitlist_entry set approved_at = now(), approved_by_staff_id = p_staff_id where id = v_place.id;
    end if;
    return v_place.id;
  end if;
  if v_place.id is not null then
    raise exception 'One list at a time: leave the other list first' using errcode = 'RVONE';
  end if;
  insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, added_by_staff_id, approved_at, approved_by_staff_id)
  values (v_venue_id, p_member_id, v_table.table_type_id, v_table.id, p_idempotency_key, p_staff_id, case when p_staff_id is not null then now() end, p_staff_id)
  returning id into v_id;
  if not exists (select 1 from public.outbox_event o
                 where o.venue_id = v_venue_id and o.event_type = 'waitlist.joined' and o.occurred_at > now() - interval '1 hour'
                   and o.payload ->> 'member_id' = p_member_id::text and o.payload ->> 'table_type_id' = v_table.table_type_id::text) then
    perform private.emit(v_venue_id, 'waitlist.joined',
                         jsonb_build_object('entry_id', v_id, 'member_id', p_member_id, 'table_type_id', v_table.table_type_id, 'table_id', v_table.id),
                         'waitlist.joined:' || v_id);
  end if;
  return v_id;
end;
$$;
revoke execute on function private.put_on_waitlist(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- A member joins a table's list from the app (feature waitlist.join): never while seated (RVONE). As
-- 20261103200100_waitlist_at_a_table.sql made it, the list now the table's own.
create or replace function private.join_waitlist_at(p_table_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'waitlist.join') then
    raise exception 'Joining a waitlist from the app is not open to you' using errcode = '42501';
  end if;
  if exists (select 1 from public.seat_session s where s.member_id = v_member_id and s.ended_at is null) then
    raise exception 'Seated at a table: one at a time' using errcode = 'RVONE';
  end if;
  return private.put_on_waitlist(v_member_id, p_table_id, p_idempotency_key, null);
end;
$$;

-- The floor (waitlist.manage) adds a member to a table's list, found by mobile number or by membership number as Seat a
-- player finds them (console v3: "Add: mobile or member no."). Exactly one of the two (22023), a blank mobile counting as
-- none; RVNOM when nobody has it.
drop function public.add_to_waitlist(uuid, text, uuid);
drop function private.add_to_waitlist(uuid, text, uuid);
create function private.add_to_waitlist(p_table_id uuid, p_phone text, p_idempotency_key uuid, p_member_number bigint default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select g.venue_id from public.game_table g where g.id = p_table_id);
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_member_id uuid;
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'waitlist.manage') then
    raise exception 'Only the floor adds a member to a waitlist' using errcode = '42501';
  end if;
  if (v_phone is null) = (p_member_number is null) then
    raise exception 'A mobile number or a membership number, one of them' using errcode = '22023';
  end if;
  select m.id into v_member_id from public.member m
  where m.venue_id = v_venue_id
    and (m.phone = '+91' || right(regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g'), 10) or m.member_number = p_member_number);
  if v_member_id is null then
    raise exception 'No member has that number' using errcode = 'RVNOM';
  end if;
  return private.put_on_waitlist(v_member_id, p_table_id, p_idempotency_key, private.current_staff_id(v_venue_id));
end;
$$;
create function public.add_to_waitlist(p_table_id uuid, p_phone text, p_idempotency_key uuid, p_member_number bigint default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.add_to_waitlist(p_table_id, p_phone, p_idempotency_key, p_member_number); $$;
revoke execute on function private.add_to_waitlist(uuid, text, uuid, bigint), public.add_to_waitlist(uuid, text, uuid, bigint) from public, anon;
grant execute on function private.add_to_waitlist(uuid, text, uuid, bigint), public.add_to_waitlist(uuid, text, uuid, bigint) to authenticated;

-- A call goes to the list's own table only (22023 any other). As 20261019091800_seat_sessions.sql made it.
create or replace function private.put_call(p_entry_id uuid, p_table_id uuid, p_seat integer)
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
  select * into v_table from public.game_table t where t.id = p_table_id for no key update;
  if v_entry.status is distinct from 'waiting' or v_entry.called_at is not null or v_entry.stepped_away_at is not null
     or v_table.id is null or v_table.id <> v_entry.table_id or not v_table.is_open
     or p_seat is null or p_seat not between 1 and v_table.seats then
    raise exception 'Call a waiting member to their list''s table while it is open, and a seat at it' using errcode = '22023';
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
  if exists (select 1 from public.seat_session s where s.table_id = v_table.id and s.seat = p_seat and s.ended_at is null) then
    raise exception 'Someone sits in that seat' using errcode = 'RVOCC';
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

-- A call that ended unseated rolls on to the next name on the called table's own list only. As
-- 20261019091800_seat_sessions.sql made it.
create or replace function private.roll_call_on(p_ended public.waitlist_entry)
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
    where r.table_id = p_ended.call_table_id and e.called_at is null and e.stepped_away_at is null
    order by r.place
  loop
    begin
      perform private.put_call(v_next.entry_id, p_ended.call_table_id, p_ended.call_seat);
      return;
    exception when sqlstate 'RVFRZ' or sqlstate 'RVHLD' or sqlstate 'RVOCC' then
      -- The venue frozen, or the seat held for another call or taken since: nobody is called to it.
      return;
    when sqlstate 'RVMBR' or sqlstate 'RVKYC' or sqlstate '22023' then
      -- A frozen member, one without a finished check, or a table closed since the call: try the next.
      continue;
    end;
  end loop;
end;
$$;

-- How many wait on each active table's list tonight (approved places), with its stake's call time in minutes (0 for none).
-- As 20261102110000_waitlist_tonight_only.sql made it, a row a table.
drop function public.waitlist_lengths();
drop function private.waitlist_lengths();
create function private.waitlist_lengths()
returns table (table_id uuid, waiting integer, call_time_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, (select count(*)::integer from public.waitlist_entry e where e.table_id = g.id and e.status = 'waiting'
                and e.approved_at is not null and e.joined_at >= private.tonight_began(now())),
         coalesce((private.setting_at(g.venue_id, 'call_time.minutes', t.code, now()) ->> 'minutes')::integer, 0)
  from public.game_table g
  join public.table_type t on t.id = g.table_type_id
  where g.active
    and ((g.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view'))
         or g.venue_id in (select private.staff_venues()));
$$;
create function public.waitlist_lengths()
returns table (table_id uuid, waiting integer, call_time_minutes integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.waitlist_lengths(); $$;

-- The joins waiting for the floor, oldest first, each with its table. As 20261102110000_waitlist_tonight_only.sql made it.
drop function public.waitlist_requests(uuid);
drop function private.waitlist_requests(uuid);
create function private.waitlist_requests(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, table_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.table_type_id, m.id, m.full_name, e.joined_at, e.table_id
  from public.waitlist_entry e
  join public.member m on m.id = e.member_id
  where e.venue_id = p_venue_id and e.status = 'waiting' and e.approved_at is null and e.joined_at >= private.tonight_began(now())
    and private.has_permission(p_venue_id, 'waitlist.manage')
  order by e.joined_at, e.id;
$$;
create function public.waitlist_requests(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, table_id uuid)
language sql stable security invoker set search_path = ''
as $$ select * from private.waitlist_requests(p_venue_id); $$;

-- A closed table's list is the interest in opening it (decision 0184, now a table's): how many wait, and whether as many
-- as `waitlist.interest_to_open` do. Every active closed table. As 20261026190000_interest_and_pot_data.sql made it.
drop function public.interest_lists(uuid);
drop function private.interest_lists(uuid);
create function private.interest_lists(p_venue_id uuid)
returns table (table_id uuid, waiting integer, players_to_open integer, is_ready boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, count(e.id)::integer, s.players, coalesce(count(e.id) >= s.players, false)
  from public.game_table g
  cross join lateral (select (private.setting_at(p_venue_id, 'waitlist.interest_to_open', '', now()) ->> 'players')::integer as players) s
  left join public.waitlist_entry e on e.table_id = g.id and e.status = 'waiting'
  where g.venue_id = p_venue_id and g.active and not g.is_open and private.has_permission(p_venue_id, 'waitlist.manage')
  group by g.id, s.players;
$$;
create function public.interest_lists(p_venue_id uuid)
returns table (table_id uuid, waiting integer, players_to_open integer, is_ready boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.interest_lists(p_venue_id); $$;

-- The TV's waitlist board, a list a table: every open active table, and a closed one somebody waits for, in floor order,
-- each place a first name and initial (none for a hidden name, #326). As 20261026090000_call_time_board.sql made it.
drop function public.tv_waitlist_board();
drop function private.tv_waitlist_board();
create function private.tv_waitlist_board()
returns table (table_id uuid, table_name text, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, is_open boolean,
               place integer, display_name text, call_table_name text, is_away boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with tables as (select g.* from public.game_table g where g.venue_id = private.tv_showing('waitlist') and g.active),
  ranked as (select r.* from private.ranked_waitlist(array(select distinct x.table_type_id from tables x)) r)
  select g.id, g.name, ty.name, ty.small_blind_paise, ty.big_blind_paise, g.is_open, r.place,
         case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end,
         ct.name, e.stepped_away_at is not null
  from tables g
  join public.table_type ty on ty.id = g.table_type_id
  left join ranked r on r.table_id = g.id
  left join public.waitlist_entry e on e.id = r.entry_id
  left join public.member m on m.id = r.member_id
  left join public.member_preference p on p.member_id = r.member_id
  left join public.game_table ct on ct.id = e.call_table_id
  where g.is_open or exists (select 1 from ranked w where w.table_id = g.id)
  order by g.position, g.name, r.place;
$$;
create function public.tv_waitlist_board()
returns table (table_id uuid, table_name text, table_type_name text, small_blind_paise bigint, big_blind_paise bigint, is_open boolean,
               place integer, display_name text, call_table_name text, is_away boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_waitlist_board(); $$;

revoke execute on function private.waitlist_lengths(), private.waitlist_requests(uuid), private.interest_lists(uuid), private.tv_waitlist_board(),
  public.waitlist_lengths(), public.waitlist_requests(uuid), public.interest_lists(uuid), public.tv_waitlist_board() from public, anon;
grant execute on function private.waitlist_lengths(), private.waitlist_requests(uuid), private.interest_lists(uuid), private.tv_waitlist_board(),
  public.waitlist_lengths(), public.waitlist_requests(uuid), public.interest_lists(uuid), public.tv_waitlist_board() to authenticated;

-- The offline pack's waitlist names each place's table, a table's list in its order. As 20261028391300_offline_pack.sql made it.
create or replace function private.offline_pack(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue public.venue;
  v_pack jsonb;
begin
  select * into v_venue from public.venue v where v.id = p_venue_id;
  if v_venue.id is null then
    raise exception 'No such venue' using errcode = '22023';
  end if;
  if v_venue.is_practice then
    raise exception 'The practice venue has no offline pack' using errcode = 'RVPRA';
  end if;
  with ledger as (
    select a.code, a.member_id, sum(e.amount)::bigint as paise
    from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
    where a.venue_id = p_venue_id and a.unit = 'paise' and a.code in ('member.cash', 'member.receivable', 'venue.chips_outstanding')
    group by a.code, a.member_id
  ),
  -- A wallet is a liability, so it is the negative of its entries; what a member owes on markers is their receivable,
  -- as the cage, the Treasury and end of day read it.
  balance as (
    select m.full_name, m.member_number, coalesce(-w.paise, 0) as wallet, coalesce(o.paise, 0) as markers
    from public.member m
    left join ledger w on w.code = 'member.cash' and w.member_id = m.id
    left join ledger o on o.code = 'member.receivable' and o.member_id = m.id
    where m.venue_id = p_venue_id and (coalesce(w.paise, 0) <> 0 or coalesce(o.paise, 0) <> 0)
  )
  select jsonb_build_object(
    'issuer', (select jsonb_build_object('legal_name', c.legal_name, 'address', c.address, 'gstin', c.gstin)
               from public.venue_config c where c.venue_id = p_venue_id),
    'venue_name', v_venue.name,
    'generated_at', now(),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('kind', c.kind, 'name', c.name, 'role', nullif(c.role, ''),
                                                             'phone', c.phone, 'note', nullif(c.notes, ''))
                                           order by c.kind, c.position, c.name)
                          from public.contact c where c.venue_id = p_venue_id), '[]'::jsonb),
    'balances', coalesce((select jsonb_agg(jsonb_build_object('name', b.full_name, 'member_number', b.member_number::text,
                                                             'wallet_paise', b.wallet, 'markers_paise', b.markers) order by b.full_name)
                          from balance b), '[]'::jsonb),
    'wallets_paise', (select coalesce(sum(b.wallet), 0)::bigint from balance b),
    'markers_paise', (select coalesce(sum(b.markers), 0)::bigint from balance b),
    'chips_in_play_paise', coalesce((select -l.paise from ledger l where l.code = 'venue.chips_outstanding' and l.member_id is null), 0),
    -- Null with no shift open, which the pack says, rather than a float of nothing.
    'cage_float_paise', (select s.float_paise from public.cage_shift s where s.venue_id = p_venue_id and s.closed_at is null),
    'tables', coalesce((select jsonb_agg(jsonb_build_object(
                          'name', g.name, 'game', tt.name,
                          'seats', coalesce((select jsonb_agg(jsonb_build_object('seat', s.seat, 'name', m.full_name, 'member_number', m.member_number::text)
                                                              order by s.seat)
                                             from public.seat_session s join public.member m on m.id = s.member_id
                                             where s.table_id = g.id and s.ended_at is null), '[]'::jsonb))
                          order by g.position)
                        from public.game_table g join public.table_type tt on tt.id = g.table_type_id
                        where g.venue_id = p_venue_id and g.is_open), '[]'::jsonb),
    'waitlist', coalesce((select jsonb_agg(jsonb_build_object('table', g.name, 'game', tt.name, 'place', r.place, 'name', m.full_name,
                                                             'member_number', m.member_number::text) order by g.position, g.name, r.place)
                          from private.ranked_waitlist(array(select t.id from public.table_type t where t.venue_id = p_venue_id)) r
                          join public.game_table g on g.id = r.table_id
                          join public.table_type tt on tt.id = r.table_type_id
                          join public.member m on m.id = r.member_id), '[]'::jsonb),
    'sops', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'version', v.version, 'in_force_from', v.effective_on, 'body', v.body)
                                       order by s.title)
                      from public.sop s cross join lateral private.sop_version_in_force(s.id) v
                      where s.venue_id = p_venue_id and v.id is not null), '[]'::jsonb))
  into v_pack;
  return v_pack;
end;
$$;

-- The practice venue's seed keeps its places on their tables, so a reset passes the new check (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
