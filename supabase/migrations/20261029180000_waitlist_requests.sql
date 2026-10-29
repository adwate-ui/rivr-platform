-- Joining is a request (#633; owner's feedback doc of 29 Oct). A member's join from the app waits for the floor, which
-- approves it onto the waitlist from the console or removes it; a member the floor adds is on the list at once. A member
-- waits for one game at a time, as they sit at one table at a time (the bug "I am able to join multiple tables at once"):
-- seated, they join no list from the app, though the floor may add them to another game's, to change tables (#77).
-- A request is called by no one. Tonight's tables also say each game's call time.

-- When the floor approved a join from the app, and who did; a place the floor added, or any row written another way,
-- is approved as it is made.
alter table public.waitlist_entry
  add column approved_at timestamptz default now(),
  add column approved_by_staff_id uuid,
  add foreign key (approved_by_staff_id, venue_id) references public.staff (id, venue_id);
create index waitlist_entry_approved_by_idx on public.waitlist_entry (approved_by_staff_id, venue_id);
update public.waitlist_entry set approved_at = joined_at;

insert into private.member_export_column (table_name, column_name, kind) values
  ('waitlist_entry', 'approved_at', 'owed'), ('waitlist_entry', 'approved_by_staff_id', 'owed');

-- One place per member: a member on more than one list keeps the place they took first.
update public.waitlist_entry e set status = 'left', left_at = now(), left_reason = 'left'
where e.status = 'waiting'
  and exists (select 1 from public.waitlist_entry o where o.member_id = e.member_id and o.status = 'waiting' and (o.joined_at, o.id) < (e.joined_at, e.id));
drop index public.waitlist_entry_one_place_idx;
create unique index waitlist_entry_one_place_idx on public.waitlist_entry (member_id) where status = 'waiting';

-- As in 20261018093200_waitlist.sql, with no join from the app while seated (RVONE).
create or replace function private.join_waitlist(p_table_type_id uuid, p_idempotency_key uuid)
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
  return private.put_on_waitlist(v_member_id, p_table_type_id, p_idempotency_key, null);
end;
$$;

-- A request is called by no one: the floor approves it onto the list first.
create function private.refuse_calling_a_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Approve the request before calling the member' using errcode = '22023';
end;
$$;
create trigger waitlist_entry_request_not_called before update of called_at on public.waitlist_entry
  for each row when (new.called_at is not null and new.approved_at is null)
  execute function private.refuse_calling_a_request();
revoke execute on function private.refuse_calling_a_request() from public, anon, authenticated;

-- As in 20261028392100_waitlist_joined_once_an_hour.sql, with one place at a time (RVONE), and a join from
-- the app waiting for the floor's approval.
create or replace function private.put_on_waitlist(p_member_id uuid, p_table_type_id uuid, p_idempotency_key uuid, p_staff_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_id uuid;
  v_place public.waitlist_entry;
  v_replay public.waitlist_entry;
begin
  -- A request id replays only the place it made: the same member, on the same list.
  select * into v_replay from public.waitlist_entry e where e.venue_id = v_venue_id and e.idempotency_key = p_idempotency_key;
  if v_replay.id is not null then
    if v_replay.member_id <> p_member_id or v_replay.table_type_id <> p_table_type_id then
      raise exception 'That request id was used for another place' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  if not exists (select 1 from public.table_type t where t.id = p_table_type_id and t.venue_id = v_venue_id) then
    raise exception 'No such game at this venue' using errcode = '22023';
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
  if v_place.table_type_id = p_table_type_id then
    -- The floor adding a member whose request for this game waits approves it.
    if p_staff_id is not null and v_place.approved_at is null then
      update public.waitlist_entry set approved_at = now(), approved_by_staff_id = p_staff_id where id = v_place.id;
    end if;
    return v_place.id;
  end if;
  if v_place.id is not null then
    raise exception 'One game at a time: leave the other list first' using errcode = 'RVONE';
  end if;
  insert into public.waitlist_entry (venue_id, member_id, table_type_id, idempotency_key, added_by_staff_id, approved_at, approved_by_staff_id)
  values (v_venue_id, p_member_id, p_table_type_id, p_idempotency_key, p_staff_id, case when p_staff_id is not null then now() end, p_staff_id)
  returning id into v_id;
  if not exists (select 1 from public.outbox_event o
                 where o.venue_id = v_venue_id and o.event_type = 'waitlist.joined' and o.occurred_at > now() - interval '1 hour'
                   and o.payload ->> 'member_id' = p_member_id::text and o.payload ->> 'table_type_id' = p_table_type_id::text) then
    perform private.emit(v_venue_id, 'waitlist.joined',
                         jsonb_build_object('entry_id', v_id, 'member_id', p_member_id, 'table_type_id', p_table_type_id),
                         'waitlist.joined:' || v_id);
  end if;
  return v_id;
end;
$$;

-- As in 20261019090400_waitlist_priority.sql, with only approved places: a request is on no list until the floor approves it.
create or replace function private.ranked_waitlist(p_table_type_ids uuid[])
returns table (entry_id uuid, table_type_id uuid, member_id uuid, joined_at timestamptz, added_by_staff_id uuid,
               place integer, priority_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.table_type_id, e.member_id, e.joined_at, e.added_by_staff_id,
         row_number() over (partition by e.table_type_id order by coalesce(p.weight, 0) desc, e.joined_at, e.id)::integer,
         p.reason
  from public.waitlist_entry e
  left join lateral private.place_priority(e.member_id, e.table_type_id, e.joined_at) p on true
  where e.status = 'waiting' and e.approved_at is not null and e.table_type_id = any (p_table_type_ids);
$$;

-- The floor (waitlist.manage) approves a join from the app onto its list, in the order the member asked. Refusals: 42501
-- not the floor, 22023 no request waiting, RVFRZ/RVMBR the venue or the member frozen. The floor removes one with
-- leave_waitlist.
create function private.approve_waitlist_request(p_entry_id uuid)
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
    raise exception 'Only the floor approves a join' using errcode = '42501';
  end if;
  if v_entry.status <> 'waiting' or v_entry.approved_at is not null then
    raise exception 'No request to approve' using errcode = '22023';
  end if;
  perform private.assert_writable(v_entry.venue_id, null, v_entry.member_id);
  update public.waitlist_entry set approved_at = now(), approved_by_staff_id = private.current_staff_id(v_entry.venue_id) where id = v_entry.id;
end;
$$;

-- The venue's joins waiting for the floor, oldest first (waitlist.manage).
create function private.waitlist_requests(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.table_type_id, m.id, m.full_name, e.joined_at
  from public.waitlist_entry e
  join public.member m on m.id = e.member_id
  where e.venue_id = p_venue_id and e.status = 'waiting' and e.approved_at is null and private.has_permission(p_venue_id, 'waitlist.manage')
  order by e.joined_at, e.id;
$$;

-- As in 20261019090600_waitlist_call_and_seat.sql, with a join still waiting for the floor: no place yet.
drop function public.my_waitlist();
drop function private.my_waitlist();
create function private.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz, is_request boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, t.id, t.name, t.small_blind_paise, t.big_blind_paise, e.joined_at, r.place, ct.name, e.call_seat, e.hold_until,
         private.away_until(e.venue_id, e.stepped_away_at, e.away_used), e.approved_at is null
  from public.waitlist_entry e
  join public.table_type t on t.id = e.table_type_id
  left join lateral private.ranked_waitlist(array[e.table_type_id]) r on r.entry_id = e.id
  left join public.game_table ct on ct.id = e.call_table_id
  where e.member_id = private.current_member_id() and e.status = 'waiting'
  order by e.joined_at;
$$;
create function public.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer, call_table_name text, call_seat integer, hold_until timestamptz,
               away_until timestamptz, is_request boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_waitlist(); $$;

-- As in 20261018093200_waitlist.sql, counting approved places only, with each game's call time in minutes (0 for none).
drop function public.waitlist_lengths();
drop function private.waitlist_lengths();
create function private.waitlist_lengths()
returns table (table_type_id uuid, waiting integer, call_time_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, (select count(*)::integer from public.waitlist_entry e where e.table_type_id = t.id and e.status = 'waiting' and e.approved_at is not null),
         coalesce((private.setting_at(t.venue_id, 'call_time.minutes', t.code, now()) ->> 'minutes')::integer, 0)
  from public.table_type t
  where (t.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view'))
     or t.venue_id in (select private.staff_venues());
$$;
create function public.waitlist_lengths()
returns table (table_type_id uuid, waiting integer, call_time_minutes integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.waitlist_lengths(); $$;

-- As in 20261019090200_link_in_bio.sql, counting the places on each list, not the requests.
create or replace function private.public_waitlist_length_rows()
returns table (venue_slug text, table_type_code text, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, t.code,
         (select count(*)::integer from public.waitlist_entry e where e.table_type_id = t.id and e.status = 'waiting' and e.approved_at is not null)
  from public.table_type t join public.venue v on v.id = t.venue_id
  where not v.is_practice;
$$;

create function public.approve_waitlist_request(p_entry_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.approve_waitlist_request(p_entry_id); $$;
create function public.waitlist_requests(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.waitlist_requests(p_venue_id); $$;

revoke execute on function private.approve_waitlist_request(uuid), private.waitlist_requests(uuid), private.my_waitlist(),
  private.waitlist_lengths() from public, anon;
grant execute on function private.approve_waitlist_request(uuid), private.waitlist_requests(uuid), private.my_waitlist(),
  private.waitlist_lengths() to authenticated;
revoke execute on function public.approve_waitlist_request(uuid), public.waitlist_requests(uuid), public.my_waitlist(),
  public.waitlist_lengths() from public, anon;
grant execute on function public.approve_waitlist_request(uuid), public.waitlist_requests(uuid), public.my_waitlist(),
  public.waitlist_lengths() to authenticated;
