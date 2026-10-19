-- Per-member feature overrides on the member record (#61; additions "Tier-gated features"). A super
-- admin (members.override_features) grants or revokes one gateable feature for one member, with a
-- reason of 3 to 500 characters and an optional last day (it ends at 06:00 IST after it); a new one
-- for the same feature replaces the one in force, and one in force can be lifted early. The super admin
-- is kept on each. Overrides are hidden from every other role: only super admins, and the member, read
-- them. Lane 0's table and has_feature are unchanged; writes now go only through these functions.
-- Refusals: 42501 not a super admin; RVNOM no such member; 22023 not a gateable feature, a reason not
-- 3 to 500 characters, or a last day passed; RVOVR no such override in force to lift; RVFRZ the venue frozen.

revoke insert, update on public.member_feature_override from authenticated;
-- A member sees that an override exists (Realtime tells their app), never why or who: the reason and
-- the staff columns are not granted to clients, as control_state's are; super admins read them
-- through member_feature_overrides.
revoke select on public.member_feature_override from authenticated;
grant select (id, venue_id, member_id, feature_key, is_granted, ends_at, revoked_at, created_at, updated_at)
  on public.member_feature_override to authenticated;

-- Who lifted an override in force, and why; an override replaced by a newer one keeps neither.
alter table public.member_feature_override
  add column lifted_by_staff_id uuid references public.staff (id),
  add column lift_reason text check (lift_reason is null or length(btrim(lift_reason)) between 3 and 500),
  add constraint member_feature_override_lift check ((lifted_by_staff_id is null) = (lift_reason is null) and (lift_reason is null or revoked_at is not null));
create index member_feature_override_lifted_by_idx on public.member_feature_override (lifted_by_staff_id);
drop policy "super admins grant overrides" on public.member_feature_override;
drop policy "super admins revoke overrides" on public.member_feature_override;
drop policy "members see their overrides; member staff see the venue's" on public.member_feature_override;
create policy "members see their overrides; super admins see the venue's" on public.member_feature_override
  for select to authenticated
  using (member_id = (select private.current_member_id()) or venue_id in (select private.venues_where('members.override_features')));

-- A super admin grants (p_is_granted) or revokes one feature for one member, in place of any in force.
create function private.set_feature_override(p_venue_id uuid, p_member_id uuid, p_feature_key text, p_is_granted boolean, p_reason text,
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

-- A super admin lifts an override in force before its end, with a reason: the member's tier decides again.
create function private.lift_feature_override(p_venue_id uuid, p_override_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'members.override_features') then
    raise exception 'Only a super admin lifts an override' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'A reason of 3 to 500 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  update public.member_feature_override o
  set revoked_at = now(), lifted_by_staff_id = private.current_staff_id(p_venue_id), lift_reason = btrim(p_reason)
  where o.id = p_override_id and o.venue_id = p_venue_id and o.revoked_at is null and (o.ends_at is null or o.ends_at > now());
  if not found then
    raise exception 'No such override in force: it has ended or been replaced' using errcode = 'RVOVR';
  end if;
end;
$$;

-- A member's overrides, newest first, for super admins: the feature, granted or revoked, why, the last
-- day, who set it, and how it stands: in force, lifted (by whom and why), replaced, or ended.
create function private.member_feature_overrides(p_venue_id uuid, p_member_id uuid)
returns table (override_id uuid, feature_key text, feature_name text, is_granted boolean, reason text, until date, standing text,
               created_at timestamptz, staff_name text, lifted_by text, lift_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.feature_key, f.name, o.is_granted, o.reason,
         case when o.ends_at is null then null else ((o.ends_at at time zone 'Asia/Kolkata') - interval '1 day')::date end,
         case when o.lift_reason is not null then 'lifted' when o.revoked_at is not null then 'replaced'
              when o.ends_at is not null and o.ends_at <= now() then 'ended' else 'in_force' end,
         o.created_at, s.full_name, l.full_name, o.lift_reason
  from public.member_feature_override o
  join public.feature f on f.key = o.feature_key
  left join public.staff s on s.id = o.created_by_staff_id
  left join public.staff l on l.id = o.lifted_by_staff_id
  where o.member_id = p_member_id and o.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.override_features')
  order by o.created_at desc;
$$;

revoke execute on function private.set_feature_override(uuid, uuid, text, boolean, text, date), private.lift_feature_override(uuid, uuid, text),
  private.member_feature_overrides(uuid, uuid) from public, anon;
grant execute on function private.set_feature_override(uuid, uuid, text, boolean, text, date), private.lift_feature_override(uuid, uuid, text),
  private.member_feature_overrides(uuid, uuid) to authenticated;

create function public.set_feature_override(p_venue_id uuid, p_member_id uuid, p_feature_key text, p_is_granted boolean, p_reason text,
                                            p_until date default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.set_feature_override(p_venue_id, p_member_id, p_feature_key, p_is_granted, p_reason, p_until); $$;
create function public.lift_feature_override(p_venue_id uuid, p_override_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.lift_feature_override(p_venue_id, p_override_id, p_reason); $$;
create function public.member_feature_overrides(p_venue_id uuid, p_member_id uuid)
returns table (override_id uuid, feature_key text, feature_name text, is_granted boolean, reason text, until date, standing text,
               created_at timestamptz, staff_name text, lifted_by text, lift_reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_feature_overrides(p_venue_id, p_member_id); $$;

revoke execute on function public.set_feature_override(uuid, uuid, text, boolean, text, date), public.lift_feature_override(uuid, uuid, text),
  public.member_feature_overrides(uuid, uuid) from public, anon;
grant execute on function public.set_feature_override(uuid, uuid, text, boolean, text, date), public.lift_feature_override(uuid, uuid, text),
  public.member_feature_overrides(uuid, uuid) to authenticated;
