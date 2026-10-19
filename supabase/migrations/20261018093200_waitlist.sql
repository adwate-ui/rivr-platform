-- The waitlist (#38, scope-v1 module 2, design prompt "Waitlist position"): one list per table type
-- (its game, stake and buy-in), in the order members joined. A member joins from the app (feature
-- waitlist.join) or the floor adds them; either way not without a finished KYC check, and not while
-- the venue or the member is frozen. Priority (black card, Founders' Circle) is #40; self-exclusion
-- joins these checks with #56. Members see their own entries and each list's length; the floor
-- (waitlist.manage) sees the lists with names.

create table public.waitlist_entry (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null,
  table_type_id uuid not null,
  status text not null default 'waiting' check (status in ('waiting', 'left')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  -- The floor staff who added the member; null when they joined from the app.
  added_by_staff_id uuid references public.staff (id),
  -- A retried join adds the member once.
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (table_type_id, venue_id) references public.table_type (id, venue_id),
  unique (venue_id, idempotency_key),
  check ((status = 'left') = (left_at is not null))
);

comment on table public.waitlist_entry is 'A member on the waitlist for one table type, from joining until leaving.';

-- One place per member per list.
create unique index waitlist_entry_one_place_idx on public.waitlist_entry (member_id, table_type_id) where status = 'waiting';
create index waitlist_entry_list_idx on public.waitlist_entry (table_type_id, joined_at) where status = 'waiting';
create index waitlist_entry_member_idx on public.waitlist_entry (member_id, venue_id);
create index waitlist_entry_venue_idx on public.waitlist_entry (venue_id);
create index waitlist_entry_type_idx on public.waitlist_entry (table_type_id, venue_id);
create index waitlist_entry_added_by_idx on public.waitlist_entry (added_by_staff_id);

create trigger waitlist_entry_touch_updated_at before update on public.waitlist_entry
  for each row execute function private.touch_updated_at();
create trigger waitlist_entry_audit after insert or update or delete on public.waitlist_entry
  for each row execute function private.audit_row_change();

alter table public.waitlist_entry enable row level security;
grant select on public.waitlist_entry to authenticated;

create policy "members see their own waitlist places" on public.waitlist_entry
  for select to authenticated
  using (member_id = (select private.current_member_id()));

create policy "the floor sees the venue's waitlist" on public.waitlist_entry
  for select to authenticated
  using (venue_id in (select private.venues_where('waitlist.manage')));

-- Puts a member on a list, once. Shared by the app's join and the floor's add; the callers check who
-- may. Refuses without a finished KYC check (RVKYC) and while the venue or member is frozen.
create function private.put_on_waitlist(p_member_id uuid, p_table_type_id uuid, p_idempotency_key uuid, p_staff_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_id uuid;
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
  if not private.is_kyc_complete(p_member_id) then
    raise exception 'Finish the identity check to join a waitlist' using errcode = 'RVKYC';
  end if;
  select e.id into v_id from public.waitlist_entry e
  where e.member_id = p_member_id and e.table_type_id = p_table_type_id and e.status = 'waiting';
  if v_id is not null then return v_id; end if;
  insert into public.waitlist_entry (venue_id, member_id, table_type_id, idempotency_key, added_by_staff_id)
  values (v_venue_id, p_member_id, p_table_type_id, p_idempotency_key, p_staff_id)
  returning id into v_id;
  perform private.emit(v_venue_id, 'waitlist.joined',
                       jsonb_build_object('entry_id', v_id, 'member_id', p_member_id, 'table_type_id', p_table_type_id),
                       'waitlist.joined:' || v_id);
  return v_id;
end;
$$;

-- A member joins from the app (feature waitlist.join).
create function private.join_waitlist(p_table_type_id uuid, p_idempotency_key uuid)
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
  return private.put_on_waitlist(v_member_id, p_table_type_id, p_idempotency_key, null);
end;
$$;

-- The floor adds a member found by their mobile number (waitlist.manage).
create function private.add_to_waitlist(p_table_type_id uuid, p_phone text, p_idempotency_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.table_type t where t.id = p_table_type_id);
  v_member_id uuid;
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'waitlist.manage') then
    raise exception 'Only the floor adds a member to a waitlist' using errcode = '42501';
  end if;
  select m.id into v_member_id from public.member m
  where m.venue_id = v_venue_id and m.phone = '+91' || right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10);
  if v_member_id is null then
    raise exception 'No member has that number' using errcode = 'RVNOM';
  end if;
  return private.put_on_waitlist(v_member_id, p_table_type_id, p_idempotency_key, private.current_staff_id(v_venue_id));
end;
$$;

-- Leaving: a member their own place, or the floor anyone's. A member may leave while the venue is
-- frozen, since leaving only gives up a claim (decision 0040); the floor's removal waits for the release.
create function private.leave_waitlist(p_entry_id uuid)
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
  update public.waitlist_entry set status = 'left', left_at = now() where id = v_entry.id;
end;
$$;

-- The signed-in member's places, with their position on each list.
create function private.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, t.id, t.name, t.small_blind_paise, t.big_blind_paise, e.joined_at,
         (select count(*)::integer from public.waitlist_entry o
          where o.table_type_id = e.table_type_id and o.status = 'waiting' and (o.joined_at, o.id) <= (e.joined_at, e.id))
  from public.waitlist_entry e join public.table_type t on t.id = e.table_type_id
  where e.member_id = private.current_member_id() and e.status = 'waiting'
  order by e.joined_at;
$$;

-- How many wait on each list at the member's venue (feature floor.live_view), or at the venues a
-- staff member works at: lengths, never names.
create function private.waitlist_lengths()
returns table (table_type_id uuid, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, (select count(*)::integer from public.waitlist_entry e where e.table_type_id = t.id and e.status = 'waiting')
  from public.table_type t
  where (t.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view'))
     or t.venue_id in (select private.staff_venues());
$$;

-- The venue's lists for the floor: each place in order, with the member's name.
create function private.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.table_type_id, m.id, m.full_name, e.joined_at,
         row_number() over (partition by e.table_type_id order by e.joined_at, e.id)::integer,
         e.added_by_staff_id is not null
  from public.waitlist_entry e join public.member m on m.id = e.member_id
  where e.venue_id = p_venue_id and e.status = 'waiting' and private.has_permission(p_venue_id, 'waitlist.manage')
  order by e.table_type_id, e.joined_at, e.id;
$$;

grant execute on function private.join_waitlist(uuid, uuid), private.add_to_waitlist(uuid, text, uuid),
  private.leave_waitlist(uuid), private.my_waitlist(), private.waitlist_lengths(), private.waitlist_board(uuid) to authenticated;
revoke execute on function private.put_on_waitlist(uuid, uuid, uuid, uuid) from authenticated;

-- A member reads tonight's tables only with floor.live_view, as waitlist_lengths gives the lengths
-- (the policies #34 added checked the venue alone).
drop policy "staff and members see the venue's table types" on public.table_type;
create policy "staff and members see the venue's table types" on public.table_type
  for select to authenticated
  using (venue_id in (select private.staff_venues())
         or (venue_id = (select private.current_member_venue_id())
             and (select private.has_feature(private.current_member_id(), 'floor.live_view'))));

drop policy "staff and members see the venue's tables" on public.game_table;
create policy "staff and members see the venue's tables" on public.game_table
  for select to authenticated
  using (venue_id in (select private.staff_venues())
         or (venue_id = (select private.current_member_venue_id())
             and (select private.has_feature(private.current_member_id(), 'floor.live_view'))));

-- Signed-in callers reach them only through these invoker wrappers.
create function public.join_waitlist(p_table_type_id uuid, p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.join_waitlist(p_table_type_id, p_idempotency_key); $$;

create function public.add_to_waitlist(p_table_type_id uuid, p_phone text, p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.add_to_waitlist(p_table_type_id, p_phone, p_idempotency_key); $$;

create function public.leave_waitlist(p_entry_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.leave_waitlist(p_entry_id); $$;

create function public.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer)
language sql security invoker set search_path = ''
as $$ select * from private.my_waitlist(); $$;

create function public.waitlist_lengths()
returns table (table_type_id uuid, waiting integer)
language sql security invoker set search_path = ''
as $$ select * from private.waitlist_lengths(); $$;

create function public.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean)
language sql security invoker set search_path = ''
as $$ select * from private.waitlist_board(p_venue_id); $$;

grant execute on function public.join_waitlist(uuid, uuid), public.add_to_waitlist(uuid, text, uuid), public.leave_waitlist(uuid),
  public.my_waitlist(), public.waitlist_lengths(), public.waitlist_board(uuid) to authenticated;
