-- The member record on the console (#60; design prompt console rail "Members"; scope-v1 module 1).
-- Staff who read members find a member by name, mobile or member number, and open their record: KYC
-- photo, tier and qualifying stake, visits and early departures (#79). A tier changes only through
-- set_member_tier, by staff with members.manage, with a reason and an optional end: every change is
-- kept, and a sweep every minute puts a member whose change has ended back on the tier they had.
-- Refusals: 42501 not allowed; RVNOM no such member; 22023 a tier not of this venue or retired, a
-- reason not 3 to 500 characters, or an end not in the future.

-- A tier is changed with its reason, never directly.
revoke update (tier_id) on public.member from authenticated;

create table public.member_tier_change (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  from_tier_id uuid not null,
  to_tier_id uuid not null,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  -- When the change ends and the member goes back to from_tier_id; null for good.
  ends_at timestamptz,
  -- Who changed it; null when the sweep ended a change.
  changed_by_staff_id uuid,
  is_expiry boolean not null default false,
  -- The clock, not the transaction's start: changes are ordered by it (tier_in_force), even two in one transaction.
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (from_tier_id, venue_id) references public.tier (id, venue_id),
  foreign key (to_tier_id, venue_id) references public.tier (id, venue_id),
  foreign key (changed_by_staff_id, venue_id) references public.staff (id, venue_id),
  check (is_expiry = (changed_by_staff_id is null)),
  check (ends_at is null or ends_at > created_at)
);

comment on table public.member_tier_change is 'Every change of a member''s tier, with its reason and end (#60); never changed.';

create index member_tier_change_member_idx on public.member_tier_change (member_id, venue_id, created_at desc);
create index member_tier_change_from_idx on public.member_tier_change (from_tier_id, venue_id);
create index member_tier_change_to_idx on public.member_tier_change (to_tier_id, venue_id);
create index member_tier_change_staff_idx on public.member_tier_change (changed_by_staff_id, venue_id);
create index member_tier_change_ends_idx on public.member_tier_change (ends_at) where ends_at is not null;
create trigger member_tier_change_never_changed before update or delete on public.member_tier_change
  for each row execute function private.refuse_change();
create trigger member_tier_change_audit after insert on public.member_tier_change
  for each row execute function private.audit_row_change();

alter table public.member_tier_change enable row level security;
grant select on public.member_tier_change to authenticated;
create policy "staff who read members see tier changes" on public.member_tier_change
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));
create policy "members see their own tier changes" on public.member_tier_change
  for select to authenticated using (member_id = (select private.current_member_id()));

-- Staff with members.manage move a member to a tier, with a reason and an optional last day: the
-- change ends as that club day ends, at 06:00 IST the morning after (#57's private.tonight_began).
create function private.set_member_tier(p_venue_id uuid, p_member_id uuid, p_tier_id uuid, p_reason text, p_until date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from uuid;
  v_ends_at timestamptz := case when p_until is null then null else ((p_until + 1) + time '06:00') at time zone 'Asia/Kolkata' end;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'members.manage') then
    raise exception 'Only a member manager changes a tier' using errcode = '42501';
  end if;
  select m.tier_id into v_from from public.member m where m.id = p_member_id and m.venue_id = p_venue_id for update;
  if v_from is null then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if not exists (select 1 from public.tier t where t.id = p_tier_id and t.venue_id = p_venue_id and not t.is_retired) or p_tier_id = v_from
     or length(btrim(coalesce(p_reason, ''))) not between 3 and 500 or (v_ends_at is not null and v_ends_at <= now()) then
    raise exception 'A different tier of this venue, a reason of 3 to 500 characters, and an end in the future' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  update public.member set tier_id = p_tier_id where id = p_member_id;
  insert into public.member_tier_change (venue_id, member_id, from_tier_id, to_tier_id, reason, ends_at, changed_by_staff_id)
  values (p_venue_id, p_member_id, v_from, p_tier_id, btrim(p_reason), v_ends_at, private.current_staff_id(p_venue_id))
  returning id into v_id;
  return v_id;
end;
$$;

-- The tier a member's changes put them on now: the newest change still in force (no end, or an end
-- to come); with none in force, the tier they had before their first change. Null with no changes.
-- So one change ending never strands a member on another that has ended, whatever the order.
create function private.tier_in_force(p_member_id uuid, p_at timestamptz)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.to_tier_id from public.member_tier_change c
     where c.member_id = p_member_id and not c.is_expiry and (c.ends_at is null or c.ends_at > p_at)
     order by c.created_at desc limit 1),
    (select c.from_tier_id from public.member_tier_change c
     where c.member_id = p_member_id and not c.is_expiry order by c.created_at limit 1));
$$;

-- Every minute: a member with a change that has ended goes onto the tier in force, once.
create function private.end_tier_changes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member record;
  v_tier uuid;
  v_was uuid;
begin
  for v_member in
    select distinct c.member_id, c.venue_id from public.member_tier_change c where not c.is_expiry and c.ends_at <= now()
  loop
    select m.tier_id into v_was from public.member m where m.id = v_member.member_id for update;
    v_tier := private.tier_in_force(v_member.member_id, now());
    continue when v_tier is null or v_tier = v_was;
    update public.member set tier_id = v_tier where id = v_member.member_id;
    insert into public.member_tier_change (venue_id, member_id, from_tier_id, to_tier_id, reason, is_expiry)
    values (v_member.venue_id, v_member.member_id, v_was, v_tier, 'The change ended', true);
  end loop;
end;
$$;

select cron.schedule('tier-change-ends', '* * * * *', 'select private.end_tier_changes()');

-- Members staff find by name (two characters or more), mobile number (four digits or more) or exact member number,
-- with their tier and visits: the Members screen's list.
create function private.member_search(p_venue_id uuid, p_query text)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_name text, visits integer, last_visit_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name, m.phone, t.name,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id)
  from public.member m
  join public.tier t on t.id = m.tier_id
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
    -- A member number matches exactly, however short; a name or mobile from two characters.
    and (m.member_number::text = trim(p_query)
         or (length(trim(coalesce(p_query, ''))) >= 2
             and (m.full_name ilike '%' || trim(p_query) || '%'
                  or (length(regexp_replace(p_query, '[^0-9]', '', 'g')) >= 4
                      and m.phone like '%' || right(regexp_replace(p_query, '[^0-9]', '', 'g'), 10) || '%'))))
  order by m.full_name
  limit 200;
$$;

-- One member's record: who they are, their tier (and a change's last day), their qualifying stake,
-- KYC, visits and early departures.
create function private.member_record(p_venue_id uuid, p_member_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_id uuid, tier_name text, tier_until date,
               qualifying_small_blind bigint, qualifying_big_blind bigint, is_kyc_complete boolean, photo_path text, visits integer,
               last_visit_at timestamptz, is_in_room boolean, early_departures integer)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name, m.phone, t.id, t.name,
         (select ((c.ends_at at time zone 'Asia/Kolkata') - interval '1 day')::date from public.member_tier_change c
          where c.member_id = m.id and not c.is_expiry and (c.ends_at is null or c.ends_at > now()) order by c.created_at desc limit 1),
         m.qualifying_small_blind, m.qualifying_big_blind, private.is_kyc_complete(m.id), k.photo_path,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id),
         private.current_visit(m.id) is not null,
         (select count(*)::integer from public.early_departure e where e.member_id = m.id)
  from public.member m
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  where m.id = p_member_id and m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read');
$$;

-- A member's early departures (#79), newest first: when, how much call time was owed, why, and who let them go.
create function private.member_early_departures(p_venue_id uuid, p_member_id uuid)
returns table (early_departure_id uuid, created_at timestamptz, shortfall_seconds integer, reason text, staff_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.created_at, e.shortfall_seconds, e.reason, s.full_name
  from public.early_departure e
  join public.staff s on s.id = e.overridden_by_staff_id
  where e.member_id = p_member_id and e.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
  order by e.created_at desc;
$$;

revoke execute on function private.end_tier_changes(), private.tier_in_force(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function private.set_member_tier(uuid, uuid, uuid, text, date), private.member_search(uuid, text),
  private.member_record(uuid, uuid), private.member_early_departures(uuid, uuid) from public, anon;
grant execute on function private.set_member_tier(uuid, uuid, uuid, text, date), private.member_search(uuid, text),
  private.member_record(uuid, uuid), private.member_early_departures(uuid, uuid) to authenticated;

create function public.set_member_tier(p_venue_id uuid, p_member_id uuid, p_tier_id uuid, p_reason text, p_until date default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.set_member_tier(p_venue_id, p_member_id, p_tier_id, p_reason, p_until); $$;
create function public.member_search(p_venue_id uuid, p_query text)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_name text, visits integer, last_visit_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_search(p_venue_id, p_query); $$;
create function public.member_record(p_venue_id uuid, p_member_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_id uuid, tier_name text, tier_until date,
               qualifying_small_blind bigint, qualifying_big_blind bigint, is_kyc_complete boolean, photo_path text, visits integer,
               last_visit_at timestamptz, is_in_room boolean, early_departures integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_record(p_venue_id, p_member_id); $$;
create function public.member_early_departures(p_venue_id uuid, p_member_id uuid)
returns table (early_departure_id uuid, created_at timestamptz, shortfall_seconds integer, reason text, staff_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_early_departures(p_venue_id, p_member_id); $$;

revoke execute on function public.set_member_tier(uuid, uuid, uuid, text, date), public.member_search(uuid, text),
  public.member_record(uuid, uuid), public.member_early_departures(uuid, uuid) from public, anon;
grant execute on function public.set_member_tier(uuid, uuid, uuid, text, date), public.member_search(uuid, text),
  public.member_record(uuid, uuid), public.member_early_departures(uuid, uuid) to authenticated;
