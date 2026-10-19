-- Check-in at the door (#72; features "Check-in and check-out"; scope-v1 module 2; the prototype's
-- console Check-in): the front desk (waitlist.manage) checks a member in by their mobile number, or
-- from the expected list (members on a waitlist not yet in the room), which opens a visit and emits
-- visit.opened. A member on a break (#56), a frozen member and a frozen venue are refused, with the
-- reason for staff. The membership QR joins with #71, check-out with #82.

create table public.visit (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  opened_at timestamptz not null default now(),
  -- The front desk who checked them in.
  opened_by_staff_id uuid,
  closed_at timestamptz,
  close_reason text check (close_reason in ('door', 'cash_out', 'end_of_day')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (opened_by_staff_id, venue_id) references public.staff (id, venue_id),
  check (closed_at is null or closed_at >= opened_at),
  check ((closed_at is null) = (close_reason is null))
);

comment on table public.visit is 'A member''s visit to the club, from check-in to check-out (#72).';

-- One open visit per member.
create unique index visit_one_open_idx on public.visit (member_id) where closed_at is null;
create index visit_venue_open_idx on public.visit (venue_id, opened_at) where closed_at is null;
create index visit_member_venue_idx on public.visit (member_id, venue_id);
create index visit_staff_venue_idx on public.visit (opened_by_staff_id, venue_id);
create trigger visit_touch_updated_at before update on public.visit
  for each row execute function private.touch_updated_at();
create trigger visit_audit after insert or update or delete on public.visit
  for each row execute function private.audit_row_change();
alter table public.visit enable row level security;
grant select on public.visit to authenticated;

create policy "members see their own visits" on public.visit
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "staff who read members see the venue's visits" on public.visit
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

-- The member's open visit, if any: the cage (#76) and the floor (#77) seat and settle within it.
create function private.current_visit(p_member_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select v.id from public.visit v where v.member_id = p_member_id and v.closed_at is null; $$;

-- Opens a visit for a member at the venue. Checking in someone already in the room gives their visit.
create function private.check_in(p_venue_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the front desk checks a member in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: the member cannot be checked in until it ends' using errcode = 'RVBRK';
  end if;
  -- One at a time per member, so two taps open one visit.
  perform 1 from public.member m where m.id = p_member_id for update;
  v_id := private.current_visit(p_member_id);
  if v_id is not null then return v_id; end if;
  insert into public.visit (venue_id, member_id, opened_by_staff_id)
  values (p_venue_id, p_member_id, private.current_staff_id(p_venue_id))
  returning id into v_id;
  perform private.emit(p_venue_id, 'visit.opened', jsonb_build_object('visit_id', v_id, 'member_id', p_member_id), 'visit.opened:' || v_id);
  return v_id;
end;
$$;

-- The front desk types the member's mobile number (the membership QR joins with #71).
create function private.check_in_by_phone(p_venue_id uuid, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the front desk checks a member in' using errcode = '42501';
  end if;
  select m.id into v_member_id from public.member m
  where m.venue_id = p_venue_id and m.phone = '+91' || right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10);
  if v_member_id is null then
    raise exception 'No member has that number' using errcode = 'RVNOM';
  end if;
  return private.check_in(p_venue_id, v_member_id);
end;
$$;

-- The door's two lists, as the prototype has them: expected (on a waitlist, not yet in the room,
-- earliest first) and in the room (open visits, earliest first), each with the member's tier.
create function private.door_board(p_venue_id uuid)
returns table (member_id uuid, full_name text, tier_name text, is_in_room boolean, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, t.name, false, min(e.joined_at)
  from public.waitlist_entry e
  join public.member m on m.id = e.member_id
  join public.tier t on t.id = m.tier_id
  where e.venue_id = p_venue_id and e.status = 'waiting' and private.current_visit(m.id) is null
    and private.has_permission(p_venue_id, 'waitlist.manage')
  group by m.id, m.full_name, t.name
  union all
  select m.id, m.full_name, t.name, true, v.opened_at
  from public.visit v
  join public.member m on m.id = v.member_id
  join public.tier t on t.id = m.tier_id
  where v.venue_id = p_venue_id and v.closed_at is null and private.has_permission(p_venue_id, 'waitlist.manage')
  order by 4, 5;
$$;

revoke execute on function private.current_visit(uuid) from public, anon, authenticated;
revoke execute on function private.check_in(uuid, uuid), private.check_in_by_phone(uuid, text), private.door_board(uuid) from public, anon;
grant execute on function private.check_in(uuid, uuid), private.check_in_by_phone(uuid, text), private.door_board(uuid) to authenticated;

create function public.check_in(p_venue_id uuid, p_member_id uuid)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.check_in(p_venue_id, p_member_id); $$;

create function public.check_in_by_phone(p_venue_id uuid, p_phone text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.check_in_by_phone(p_venue_id, p_phone); $$;

create function public.door_board(p_venue_id uuid)
returns table (member_id uuid, full_name text, tier_name text, is_in_room boolean, since timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.door_board(p_venue_id); $$;

revoke execute on function public.check_in(uuid, uuid), public.check_in_by_phone(uuid, text), public.door_board(uuid) from public, anon;
grant execute on function public.check_in(uuid, uuid), public.check_in_by_phone(uuid, text), public.door_board(uuid) to authenticated;
