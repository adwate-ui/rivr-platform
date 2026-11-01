-- One person, one approval (B3 of the Fix Tracker; the 28 Oct audit). The two-person checks (deciding an expense,
-- releasing a freeze, approving a promotion or a credit raise) compare staff rows, so one person with a second login
-- defeats them; and a manager could change their own member record.

-- Roles that move the venue's money, give a second approval or stop the venue (treasury.manage, cage.second_approve,
-- control.engage) are granted by a super admin (venue.configure) alone: an admin no longer makes a second admin login.
-- As in 20261020170000_cage_computers.sql, with that.
create or replace function private.can_grant_role(p_venue_id uuid, p_role public.staff_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select rp.permission from public.staff s join public.role_permission rp on rp.role = s.role
    where s.user_id = (select auth.uid()) and s.venue_id = p_venue_id and s.is_active
      and not exists (select 1 from public.control_state c
                      where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null)
  )
  select exists (select 1 from mine where permission = 'venue.configure')
    or (not exists (select 1 from public.role_permission rp where rp.role = p_role and rp.permission not in (select permission from mine))
        and not exists (select 1 from public.role_permission rp where rp.role = p_role
                        and rp.permission in ('treasury.manage', 'cage.second_approve', 'control.engage')));
$$;

-- A staff manager changes their own job title though their own role is no longer one they grant. The staff guard below
-- refuses their own role, switching themselves off, and their own number or name, which the own-record checks compare.
create policy "staff managers change their own details" on public.staff
  for update to authenticated
  using (venue_id in (select private.venues_where('staff.manage')) and id = private.current_staff_id(venue_id))
  with check (venue_id in (select private.venues_where('staff.manage')) and id = private.current_staff_id(venue_id));

-- As in 20261020095511_staff_guard.sql, also refusing a change to one's own number or name: is_own_cage_record and
-- is_own_kyc_check compare them, so changing them would step around those checks.
create or replace function private.staff_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) is distinct from 'authenticated' then
    return new;
  end if;
  if old.user_id = (select auth.uid()) and (new.role is distinct from old.role or (old.is_active and not new.is_active)) then
    raise exception 'Staff do not change their own role or turn themselves off' using errcode = 'RVOWN';
  end if;
  if old.user_id = (select auth.uid()) and (new.phone is distinct from old.phone or new.full_name is distinct from old.full_name) then
    raise exception 'Staff do not change their own number or name' using errcode = 'RVOWN';
  end if;
  if old.role = 'super_admin' and old.is_active and (new.role <> 'super_admin' or not new.is_active) then
    -- Two managers each taking away one of the last ones would otherwise both succeed.
    perform pg_advisory_xact_lock(hashtextextended('venue_super_admins:' || old.venue_id::text, 0));
    if private.engagers(old.venue_id, old.id) < 2 then
      raise exception 'That would leave fewer than two super admins able to release a venue freeze' using errcode = 'RVLCK';
    end if;
  end if;
  return new;
end;
$$;

-- The owner hears whenever someone signed in adds such a staff row, gives a row such a role, turns one back on, or
-- changes its number (a new hire's row given another phone before they sign in). Promotions count too: whoever submits
-- one is the other person its approver needs. The seed and a venue's first super admin, made by the server, are not
-- signed in.
create function private.alert_dual_control_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and new.is_active
     and (tg_op = 'INSERT' or old.role is distinct from new.role or not old.is_active or old.phone is distinct from new.phone)
     and exists (select 1 from public.role_permission rp where rp.role = new.role
                 and rp.permission in ('treasury.manage', 'cage.second_approve', 'control.engage', 'promotions.manage')) then
    perform private.raise_alert(new.venue_id, 'staff.role_granted',
                                jsonb_build_object('staff_id', new.id, 'role', new.role, 'by_staff_id', private.current_staff_id(new.venue_id)));
  end if;
  return null;
end;
$$;
create trigger staff_role_granted after insert or update of role, is_active, phone on public.staff
  for each row execute function private.alert_dual_control_grant();
revoke execute on function private.alert_dual_control_grant() from public, anon, authenticated;

-- Those able to release a freeze are people who sign in: a staff row with no login is no second super admin. As in
-- 20261019093000_kill_switch.sql, with that.
create or replace function private.engagers(p_venue_id uuid, p_except uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.staff s
  join public.role_permission rp on rp.role = s.role and rp.permission = 'control.engage'
  where s.venue_id = p_venue_id and s.is_active and s.user_id is not null and s.id is distinct from p_except
    and not exists (select 1 from public.control_state c where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null);
$$;

-- Nobody changes their own member record's tier (RVOWN), as a cashier never serves their own record. As in
-- 20261019092800_member_record.sql, with that.
create or replace function private.set_member_tier(p_venue_id uuid, p_member_id uuid, p_tier_id uuid, p_reason text, p_until date)
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
  if private.is_own_cage_record(p_member_id) then
    raise exception 'Nobody changes their own member record''s tier' using errcode = 'RVOWN';
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

-- Nor their own feature overrides. As in 20261019092900_feature_overrides.sql, with that.
create or replace function private.set_feature_override(p_venue_id uuid, p_member_id uuid, p_feature_key text, p_is_granted boolean, p_reason text,
                                                        p_until date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ends_at timestamptz := case when p_until is null then null else ((p_until + 1) + time '06:00') at time zone 'Asia/Kolkata' end;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'members.override_features') then
    raise exception 'Only a super admin overrides a feature' using errcode = '42501';
  end if;
  if private.is_own_cage_record(p_member_id) then
    raise exception 'Nobody overrides a feature on their own member record' using errcode = 'RVOWN';
  end if;
  perform 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id for update;
  if not found then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if not exists (select 1 from public.feature f where f.key = p_feature_key and f.is_gateable) or p_is_granted is null
     or length(btrim(coalesce(p_reason, ''))) not between 3 and 500 or (v_ends_at is not null and v_ends_at <= now()) then
    raise exception 'A gateable feature, a reason of 3 to 500 characters, and a last day still to come' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  update public.member_feature_override o set revoked_at = now()
  where o.member_id = p_member_id and o.feature_key = p_feature_key and o.revoked_at is null and (o.ends_at is null or o.ends_at > now());
  insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason, ends_at, created_by_staff_id)
  values (p_venue_id, p_member_id, p_feature_key, p_is_granted, btrim(p_reason), v_ends_at, private.current_staff_id(p_venue_id))
  returning id into v_id;
  return v_id;
end;
$$;

-- A revoked or inactive staff member reads their own shifts and attendance no more. As in
-- 20261028030000_rosters_and_attendance.sql, through current_staff_id.
drop policy "staff managers see the roster; everyone their own shifts" on public.staff_shift;
create policy "staff managers see the roster; everyone their own shifts" on public.staff_shift
  for select to authenticated using (
    private.has_permission(venue_id, 'staff.manage') or staff_id = private.current_staff_id(venue_id));
drop policy "staff managers see attendance; everyone their own" on public.staff_attendance;
create policy "staff managers see attendance; everyone their own" on public.staff_attendance
  for select to authenticated using (
    private.has_permission(venue_id, 'staff.manage')
    or shift_id in (select h.id from public.staff_shift h where h.staff_id = private.current_staff_id(h.venue_id)));
