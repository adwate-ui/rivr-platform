-- The events calendar (#143; scope-v1 module 7): pro nights and corporate tables the club adds, with their seats,
-- listed in the app beside the open Academy batches, and booked by a member with events.book (rule 8). Staff who run
-- promotions add events and read how many have booked. Erasure deletes a member's bookings.
insert into public.feature (key, name, description, screens, is_gateable) values
  ('events.book', 'Events', 'The events calendar: pro nights, corporate tables and Academy batches, booked from the app.', '{player:events}', true);
-- Every tier of an existing venue has it, as a new venue's tiers do (bootstrap_venue).
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, 'events.book', true, 'locked', '-infinity' from public.tier t;

create table public.club_event (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  kind text not null check (kind in ('pro_night', 'corporate_table')),
  title text not null check (length(btrim(title)) between 1 and 100),
  starts_at timestamptz not null,
  seats integer not null check (seats between 1 and 500),
  details text check (length(details) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id)
);
comment on table public.club_event is 'A pro night or corporate table on the events calendar (#143), with its seats.';
create index club_event_venue_idx on public.club_event (venue_id, starts_at);

create table public.club_event_booking (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  event_id uuid not null,
  member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, venue_id) references public.club_event (id, venue_id),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  unique (event_id, member_id)
);
comment on table public.club_event_booking is 'A member''s seat at a calendar event (#143).';
create index club_event_booking_member_idx on public.club_event_booking (member_id, venue_id);
create index club_event_booking_venue_idx on public.club_event_booking (venue_id);

create trigger club_event_touch_updated_at before update on public.club_event for each row execute function private.touch_updated_at();
create trigger club_event_audit after insert or update or delete on public.club_event for each row execute function private.audit_row_change();
create trigger club_event_booking_touch_updated_at before update on public.club_event_booking
  for each row execute function private.touch_updated_at();
create trigger club_event_booking_audit after insert or update or delete on public.club_event_booking
  for each row execute function private.audit_row_change();

alter table public.club_event enable row level security;
alter table public.club_event_booking enable row level security;
grant select on public.club_event, public.club_event_booking to authenticated;
create policy "members with events see their club's events" on public.club_event
  for select to authenticated using (venue_id = (select private.current_member_venue_id())
                                     and private.has_feature((select private.current_member_id()), 'events.book'));
create policy "staff who run promotions see the venue's events" on public.club_event
  for select to authenticated using (venue_id in (select private.venues_where('promotions.manage')));
create policy "members see their own event bookings" on public.club_event_booking
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "staff who run promotions see the venue's event bookings" on public.club_event_booking
  for select to authenticated using (venue_id in (select private.venues_where('promotions.manage')));

-- A member's export gives their bookings whole (decision 0240).
insert into private.member_export_column (table_name, column_name, kind)
select 'club_event_booking', c.column_name, 'owed'
from unnest(array['id', 'venue_id', 'event_id', 'member_id', 'created_at', 'updated_at']) c (column_name);

-- Adds an event still to come. Refusals: 42501 not staff who run promotions; 22023 out of bounds or already past;
-- RVFRZ the venue frozen.
create function private.create_club_event(p_venue_id uuid, p_kind text, p_title text, p_starts_at timestamptz, p_seats integer, p_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false) then
    raise exception 'Staff who run promotions add events' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'An event still to come' using errcode = '22023';
  end if;
  insert into public.club_event (venue_id, kind, title, starts_at, seats, details)
  values (p_venue_id, p_kind, btrim(coalesce(p_title, '')), p_starts_at, p_seats, nullif(btrim(coalesce(p_details, '')), ''))
  returning id into v_id;
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'A pro night or corporate table, a title, 1 to 500 seats and at most 500 characters of details' using errcode = '22023';
end;
$$;

-- The venue's events from twelve hours ago on, each with how many have booked, for staff who run promotions.
create function private.venue_club_events(p_venue_id uuid)
returns table (event_id uuid, kind text, title text, starts_at timestamptz, seats integer, booked integer, details text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.kind, e.title, e.starts_at, e.seats, (select count(*)::integer from public.club_event_booking b where b.event_id = e.id), e.details
  from public.club_event e
  where e.venue_id = p_venue_id and private.has_permission(p_venue_id, 'promotions.manage') and e.starts_at > now() - interval '12 hours'
  order by e.starts_at;
$$;

-- The events still to come at the member's club, with the seats left and whether they have booked (events.book).
create function private.my_club_events()
returns table (event_id uuid, kind text, title text, starts_at timestamptz, seats integer, seats_left integer, details text, is_booked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.kind, e.title, e.starts_at, e.seats,
         e.seats - (select count(*)::integer from public.club_event_booking b where b.event_id = e.id), e.details,
         exists (select 1 from public.club_event_booking b where b.event_id = e.id and b.member_id = private.current_member_id())
  from public.club_event e
  where e.venue_id = private.current_member_venue_id() and e.starts_at > now()
    and private.has_feature(private.current_member_id(), 'events.book')
  order by e.starts_at;
$$;

-- The member books a seat at an event of their club, once; or gives it back. Refusals: 42501 not a member of the
-- event's club with events.book; RVEVT the event has started (hint past) or every seat is booked (hint full);
-- RVFRZ/RVMBR the venue or the member frozen.
create function private.book_club_event(p_event_id uuid, p_is_booking boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.club_event;
  v_member_id uuid := private.current_member_id();
begin
  -- One booking at a time per event, so two never take its last seat.
  select * into v_event from public.club_event e where e.id = p_event_id for update;
  if v_event.id is null or v_member_id is null or v_event.venue_id is distinct from private.current_member_venue_id()
     or not private.has_feature(v_member_id, 'events.book') then
    raise exception 'A member books an event at their own club' using errcode = '42501';
  end if;
  perform private.assert_writable(v_event.venue_id, null, v_member_id);
  if v_event.starts_at <= now() then
    raise exception 'This event has started' using errcode = 'RVEVT', hint = 'past';
  end if;
  if not p_is_booking then
    delete from public.club_event_booking b where b.event_id = v_event.id and b.member_id = v_member_id;
    return;
  end if;
  if exists (select 1 from public.club_event_booking b where b.event_id = v_event.id and b.member_id = v_member_id) then
    return;
  end if;
  if (select count(*) from public.club_event_booking b where b.event_id = v_event.id) >= v_event.seats then
    raise exception 'Every seat is booked' using errcode = 'RVEVT', hint = 'full';
  end if;
  insert into public.club_event_booking (venue_id, event_id, member_id) values (v_event.venue_id, v_event.id, v_member_id);
end;
$$;

create function public.create_club_event(p_venue_id uuid, p_kind text, p_title text, p_starts_at timestamptz, p_seats integer, p_details text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.create_club_event(p_venue_id, p_kind, p_title, p_starts_at, p_seats, p_details); $$;
create function public.venue_club_events(p_venue_id uuid)
returns table (event_id uuid, kind text, title text, starts_at timestamptz, seats integer, booked integer, details text)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_club_events(p_venue_id); $$;
create function public.my_club_events()
returns table (event_id uuid, kind text, title text, starts_at timestamptz, seats integer, seats_left integer, details text, is_booked boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_club_events(); $$;
create function public.book_club_event(p_event_id uuid, p_is_booking boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.book_club_event(p_event_id, p_is_booking); $$;

revoke execute on function private.create_club_event(uuid, text, text, timestamptz, integer, text), private.venue_club_events(uuid),
  private.my_club_events(), private.book_club_event(uuid, boolean),
  public.create_club_event(uuid, text, text, timestamptz, integer, text), public.venue_club_events(uuid), public.my_club_events(),
  public.book_club_event(uuid, boolean) from public, anon;
grant execute on function private.create_club_event(uuid, text, text, timestamptz, integer, text), private.venue_club_events(uuid),
  private.my_club_events(), private.book_club_event(uuid, boolean),
  public.create_club_event(uuid, text, text, timestamptz, integer, text), public.venue_club_events(uuid), public.my_club_events(),
  public.book_club_event(uuid, boolean) to authenticated;

-- As before (20261028392600_cab_requests.sql), deleting the member's event bookings too.
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
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;
