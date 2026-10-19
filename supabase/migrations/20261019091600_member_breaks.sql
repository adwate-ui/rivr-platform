-- Limits and breaks (#56; scope-v1 modules 1 and 12; the prototype's Profile): a member sets a
-- session reminder (none, 4, 6 or 8 hours) and takes a break of 24 hours, 7 days or 30 days; the
-- floor (members.manage) sets one of up to ten years, with a reason. A break cannot be shortened: its
-- rows never change, and a shorter one while a longer runs changes nothing. While a break runs the
-- member is off every waitlist and cannot join one; the door (#72) and the cage (#57) ask
-- private.member_restrictions too. The reminder is kept now and sent once seat sessions exist (#77).

create table public.member_limit (
  member_id uuid primary key,
  venue_id uuid not null,
  -- Hours seated before the app reminds the member; null for none.
  session_reminder_hours smallint check (session_reminder_hours in (4, 6, 8)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.member_limit is 'A member''s own limits: the session reminder (#56).';

create index member_limit_venue_idx on public.member_limit (venue_id);
create trigger member_limit_touch_updated_at before update on public.member_limit
  for each row execute function private.touch_updated_at();
create trigger member_limit_audit after insert or update or delete on public.member_limit
  for each row execute function private.audit_row_change();
alter table public.member_limit enable row level security;
grant select on public.member_limit to authenticated;

create table public.self_exclusion (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  -- The floor staff who set it, with why; both null when the member took it from the app.
  set_by_staff_id uuid,
  reason text check (reason is null or length(trim(reason)) between 3 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (set_by_staff_id, venue_id) references public.staff (id, venue_id),
  check (ends_at > starts_at),
  check ((set_by_staff_id is null) = (reason is null))
);

comment on table public.self_exclusion is 'Breaks from play, taken by the member or set by the floor; never shortened (#56).';

create index self_exclusion_member_idx on public.self_exclusion (member_id, ends_at desc);
create index self_exclusion_member_venue_idx on public.self_exclusion (member_id, venue_id);
create index self_exclusion_venue_idx on public.self_exclusion (venue_id);
create index self_exclusion_staff_venue_idx on public.self_exclusion (set_by_staff_id, venue_id);
create trigger self_exclusion_never_changed before update or delete on public.self_exclusion
  for each row execute function private.refuse_change();
create trigger self_exclusion_no_truncate before truncate on public.self_exclusion
  for each statement execute function private.refuse_change();
create trigger self_exclusion_audit after insert on public.self_exclusion
  for each row execute function private.audit_row_change();
alter table public.self_exclusion enable row level security;
grant select on public.self_exclusion to authenticated;

create policy "members see their own limits" on public.member_limit
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "staff who read members see the venue's limits" on public.member_limit
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));
create policy "members see their own breaks" on public.self_exclusion
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "staff who read members see the venue's breaks" on public.self_exclusion
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

-- What restricts a member at a moment: the end of the break running then (null for none), and the
-- session reminder. The waitlist, the door (#72) and the cage (#57) refuse a member on a break.
create function private.member_restrictions(p_member_id uuid, p_at timestamptz)
returns table (break_until timestamptz, session_reminder_hours smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select (select max(x.ends_at) from public.self_exclusion x where x.member_id = p_member_id and x.starts_at <= p_at and x.ends_at > p_at),
         (select l.session_reminder_hours from public.member_limit l where l.member_id = p_member_id);
$$;

-- A waitlist place ended by a break says so.
alter table public.waitlist_entry drop constraint waitlist_entry_left_reason_check;
alter table public.waitlist_entry add constraint waitlist_entry_left_reason_check
  check (left_reason in ('left', 'missed', 'stepped_away', 'break'));

-- Starts a break until p_ends_at and takes the member off every waitlist, a called place rolling its
-- seat to the next name. One that ends no later than the break already running changes nothing.
create function private.start_break(p_member_id uuid, p_ends_at timestamptz, p_staff_id uuid, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_until timestamptz := (select r.break_until from private.member_restrictions(p_member_id, now()) r);
  v_entry public.waitlist_entry;
begin
  if v_until >= p_ends_at then return v_until; end if;
  insert into public.self_exclusion (venue_id, member_id, ends_at, set_by_staff_id, reason)
  values (v_venue_id, p_member_id, p_ends_at, p_staff_id, nullif(trim(p_reason), ''));
  for v_entry in
    update public.waitlist_entry e set status = 'left', left_at = now(), left_reason = 'break'
    where e.member_id = p_member_id and e.status = 'waiting'
    returning e.*
  loop
    if v_entry.called_at is not null then perform private.roll_call_on(v_entry); end if;
  end loop;
  perform private.emit(v_venue_id, 'member.break_started', jsonb_build_object('member_id', p_member_id, 'ends_at', p_ends_at),
                       'member.break_started:' || p_member_id || ':' || p_ends_at);
  return p_ends_at;
end;
$$;

-- The member takes a break from Profile: 24 hours, 7 days or 30 days, as the prototype offers. Also
-- while the venue or the member is frozen, since a break only gives something up.
create function private.take_break(p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
begin
  if v_member_id is null then
    raise exception 'Only a member takes a break' using errcode = '42501';
  end if;
  if p_days is null or p_days not in (1, 7, 30) then
    raise exception 'A break is 24 hours, 7 days or 30 days' using errcode = '22023';
  end if;
  return private.start_break(v_member_id, now() + make_interval(days => p_days), null, null);
end;
$$;

-- The floor sets a break for a member (members.manage), from a day to ten years, with a reason.
create function private.set_member_break(p_member_id uuid, p_days integer, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'members.manage') then
    raise exception 'Only staff who manage members set a break' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id);
  if p_days is null or p_days not between 1 and 3650 or length(trim(coalesce(p_reason, ''))) not between 3 and 300 then
    raise exception 'A break is one day to ten years, with a reason' using errcode = '22023';
  end if;
  return private.start_break(p_member_id, now() + make_interval(days => p_days), private.current_staff_id(v_venue_id), p_reason);
end;
$$;

-- The member's session reminder: 4, 6 or 8 hours, or none (left out).
create function private.set_session_reminder(p_hours integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
begin
  if v_member_id is null then
    raise exception 'Only a member sets a session reminder' using errcode = '42501';
  end if;
  if p_hours is not null and p_hours not in (4, 6, 8) then
    raise exception 'A session reminder is 4, 6 or 8 hours, or none' using errcode = '22023';
  end if;
  insert into public.member_limit (member_id, venue_id, session_reminder_hours)
  values (v_member_id, (select m.venue_id from public.member m where m.id = v_member_id), p_hours)
  on conflict (member_id) do update set session_reminder_hours = excluded.session_reminder_hours;
end;
$$;

-- The signed-in member's own restrictions now.
create function private.my_restrictions()
returns table (break_until timestamptz, session_reminder_hours smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.break_until, r.session_reminder_hours
  from private.member_restrictions(private.current_member_id(), now()) r
  where private.current_member_id() is not null;
$$;

revoke execute on function private.member_restrictions(uuid, timestamptz),
  private.start_break(uuid, timestamptz, uuid, text) from public, anon, authenticated;
revoke execute on function private.take_break(integer), private.set_member_break(uuid, integer, text),
  private.set_session_reminder(integer), private.my_restrictions() from public, anon;
grant execute on function private.take_break(integer), private.set_member_break(uuid, integer, text),
  private.set_session_reminder(integer), private.my_restrictions() to authenticated;

create function public.take_break(p_days integer)
returns timestamptz language sql volatile security invoker set search_path = ''
as $$ select private.take_break(p_days); $$;

create function public.set_member_break(p_member_id uuid, p_days integer, p_reason text)
returns timestamptz language sql volatile security invoker set search_path = ''
as $$ select private.set_member_break(p_member_id, p_days, p_reason); $$;

create function public.set_session_reminder(p_hours integer default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_session_reminder(p_hours); $$;

create function public.my_restrictions()
returns table (break_until timestamptz, session_reminder_hours smallint) language sql stable security invoker set search_path = ''
as $$ select * from private.my_restrictions(); $$;

revoke execute on function public.take_break(integer), public.set_member_break(uuid, integer, text),
  public.set_session_reminder(integer), public.my_restrictions() from public, anon;
grant execute on function public.take_break(integer), public.set_member_break(uuid, integer, text),
  public.set_session_reminder(integer), public.my_restrictions() to authenticated;

-- A member on a break cannot join a waitlist, nor the floor add them (RVBRK). As #38 built it, with
-- the break check after the identity check.
create or replace function private.put_on_waitlist(p_member_id uuid, p_table_type_id uuid, p_idempotency_key uuid, p_staff_id uuid)
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
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: waitlists are closed until it ends' using errcode = 'RVBRK';
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

-- Limits live on Profile itself, as in the prototype.
update public.feature set screens = '{player:profile}' where key = 'core.limits';
