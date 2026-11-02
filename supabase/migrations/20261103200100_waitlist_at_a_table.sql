-- A member joins at a table (decision 0321): the join sheet is a table's, so the place records the table asked for. The list
-- itself, its order and priority, stay the stake's (table_type), and the floor's Assign starts from the table asked for.
-- A called member says they are on their way ("I'm on my way", brief 3.4 D); declining is leaving the list, as before,
-- which rolls the call on to the next name.

alter table public.waitlist_entry
  add column table_id uuid references public.game_table (id),
  add column on_way_at timestamptz;

comment on column public.waitlist_entry.table_id is 'The table the member asked for from the app (decision 0321); the list is the stake''s.';
comment on column public.waitlist_entry.on_way_at is 'When the called member said they were on their way (decision 0321).';
insert into private.member_export_column (table_name, column_name, kind)
values ('waitlist_entry', 'table_id', 'owed'), ('waitlist_entry', 'on_way_at', 'owed');

-- Joining at a table: the stake's list, as join_waitlist, with the table kept on the place. A table of another venue is refused.
create function private.join_waitlist_at(p_table_id uuid, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.game_table;
  v_id uuid;
begin
  select * into v_table from public.game_table g where g.id = p_table_id and g.venue_id = private.current_member_venue_id();
  if v_table.id is null then
    raise exception 'No such table at this venue' using errcode = '22023';
  end if;
  v_id := private.join_waitlist(v_table.table_type_id, p_idempotency_key);
  update public.waitlist_entry set table_id = v_table.id where id = v_id and table_id is null;
  return v_id;
end;
$$;
create function public.join_waitlist_at(p_table_id uuid, p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.join_waitlist_at(p_table_id, p_idempotency_key); $$;

revoke execute on function private.join_waitlist_at(uuid, uuid), public.join_waitlist_at(uuid, uuid) from public, anon;
grant execute on function private.join_waitlist_at(uuid, uuid), public.join_waitlist_at(uuid, uuid) to authenticated;

-- "I'm on my way": the member whose seat is held says so, once a call; the floor sees it on the list. Not after the hold.
-- It answers the call in force: called again (or skipped and called), the place shows no answer until the member gives one.
create function private.accept_seat_call(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entry;
begin
  select * into v_entry from public.waitlist_entry e where e.id = p_entry_id and e.member_id = private.current_member_id() for update;
  if v_entry.id is null or not private.has_feature(v_entry.member_id, 'waitlist.join') then
    raise exception 'Only the member called says they are on their way' using errcode = '42501';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, v_entry.member_id);
  if v_entry.status <> 'waiting' or v_entry.called_at is null or v_entry.hold_until < now() then
    raise exception 'No seat is held for you' using errcode = '22023';
  end if;
  -- Once a call: an answer to an earlier call the floor skipped or called again does not count for this one.
  update public.waitlist_entry set on_way_at = case when on_way_at >= called_at then on_way_at else now() end where id = v_entry.id;
end;
$$;
create function public.accept_seat_call(p_entry_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.accept_seat_call(p_entry_id); $$;

revoke execute on function private.accept_seat_call(uuid), public.accept_seat_call(uuid) from public, anon;
grant execute on function private.accept_seat_call(uuid), public.accept_seat_call(uuid) to authenticated;

-- As 20261102110000_waitlist_tonight_only.sql made it, with the table asked for, when the seat was called (the hold drains
-- from there) and when the member said they were on their way.
drop function public.my_waitlist();
drop function private.my_waitlist();
create function private.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz, is_request boolean, table_id uuid, table_name text, called_at timestamptz, on_way_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, t.id, t.name, t.small_blind_paise, t.big_blind_paise, e.joined_at, r.place, ct.name, e.call_seat, e.hold_until,
         private.away_until(e.venue_id, e.stepped_away_at, e.away_used), e.approved_at is null, e.table_id, asked.name, e.called_at,
         case when e.on_way_at >= e.called_at then e.on_way_at end
  from public.waitlist_entry e
  join public.table_type t on t.id = e.table_type_id
  left join lateral private.ranked_waitlist(array[e.table_type_id]) r on r.entry_id = e.id
  left join public.game_table ct on ct.id = e.call_table_id
  left join public.game_table asked on asked.id = e.table_id
  where e.member_id = private.current_member_id() and e.status = 'waiting' and e.joined_at >= private.tonight_began(now())
  order by e.joined_at;
$$;
create function public.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz, is_request boolean, table_id uuid, table_name text, called_at timestamptz, on_way_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_waitlist(); $$;

revoke execute on function private.my_waitlist(), public.my_waitlist() from public, anon;
grant execute on function private.my_waitlist(), public.my_waitlist() to authenticated;

-- As 20261019090600_waitlist_call_and_seat.sql made it, with the table the member asked for and when a called member said
-- they were on their way.
drop function public.waitlist_board(uuid);
drop function private.waitlist_board(uuid);
create function private.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean, priority_reason text, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz, asked_table_id uuid, on_way_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.entry_id, r.table_type_id, m.id, m.full_name, r.joined_at, r.place, r.added_by_staff_id is not null, r.priority_reason,
         ct.name, e.call_seat, e.hold_until, private.away_until(e.venue_id, e.stepped_away_at, e.away_used), e.table_id,
         case when e.on_way_at >= e.called_at then e.on_way_at end
  from private.ranked_waitlist(array(select t.id from public.table_type t where t.venue_id = p_venue_id)) r
  join public.waitlist_entry e on e.id = r.entry_id
  join public.member m on m.id = r.member_id
  left join public.game_table ct on ct.id = e.call_table_id
  where private.has_permission(p_venue_id, 'waitlist.manage')
  order by r.table_type_id, r.place;
$$;
create function public.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean, priority_reason text, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz, asked_table_id uuid, on_way_at timestamptz)
language sql security invoker set search_path = ''
as $$ select * from private.waitlist_board(p_venue_id); $$;

revoke execute on function private.waitlist_board(uuid), public.waitlist_board(uuid) from public, anon;
grant execute on function private.waitlist_board(uuid), public.waitlist_board(uuid) to authenticated;

-- The practice venue's seed keeps the new columns (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
