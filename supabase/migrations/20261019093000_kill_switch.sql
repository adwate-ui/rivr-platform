-- The kill switch's engage and release (#27; features "Kill switch"; additions flow 15). Any super
-- admin (control.engage) engages any level with a reason of 3 to 500 characters: the venue frozen,
-- one feature switched off, messaging stopped, one member frozen, or one staff member's access
-- revoked (a device's is revoked on the Tablets and TVs screens). A release needs a reason; a venue
-- freeze needs two different super admins: the first asks, with the reason, and a second releases it.
-- Every engage, request and release is audited (control_state's trigger), goes to the outbox
-- (control.engaged, control.released) and raises an owner alert. Refusals: 42501 not a super admin;
-- 22023 a reason not 3 to 500 characters, a missing or wrong target, or a control not engaged; RVTWO
-- the super admin who asked tries to release the freeze too; RVLCK a freeze or a revoke that would
-- leave fewer than two super admins able to release a freeze.

-- How many staff at the venue may engage and release the kill switch, leaving one out: active, and
-- with no access revoke engaged on them.
create function private.engagers(p_venue_id uuid, p_except uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.staff s
  join public.role_permission rp on rp.role = s.role and rp.permission = 'control.engage'
  where s.venue_id = p_venue_id and s.is_active and s.id is distinct from p_except
    and not exists (select 1 from public.control_state c where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null);
$$;

-- A super admin engages a control; engaging one already engaged on the same target gives that one.
-- A venue freeze takes two to release, so the switch never leaves fewer than two super admins able to.
create function private.engage_control(p_venue_id uuid, p_level public.control_level, p_reason text, p_feature public.killable_feature,
                                       p_member_id uuid, p_staff_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_venue_id is null then
    raise exception 'Only a super admin engages the kill switch' using errcode = '42501';
  end if;
  -- One at a time per venue, the caller checked after: two super admins revoking each other wait in
  -- turn, and the second is no longer a super admin when its turn comes.
  perform pg_advisory_xact_lock(hashtextextended('control:' || p_venue_id, 0));
  if not private.has_permission(p_venue_id, 'control.engage') then
    raise exception 'Only a super admin engages the kill switch' using errcode = '42501';
  end if;
  if p_level is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 500
     or (p_level = 'feature_kill') <> (p_feature is not null)
     or (p_level = 'member_freeze') <> (p_member_id is not null and exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id))
     or (p_level = 'access_revoke') <> (p_staff_id is not null and exists (select 1 from public.staff s where s.id = p_staff_id and s.venue_id = p_venue_id))
     or p_staff_id = private.current_staff_id(p_venue_id) then
    raise exception 'A reason of 3 to 500 characters, and the feature, member or staff member the level needs (never yourself)' using errcode = '22023';
  end if;
  if (p_level = 'venue_freeze' and private.engagers(p_venue_id, null) < 2)
     or (p_level = 'access_revoke' and private.engagers(p_venue_id, null) - private.engagers(p_venue_id, p_staff_id) = 1
         and private.engagers(p_venue_id, p_staff_id) < 2) then
    raise exception 'That would leave fewer than two super admins able to release a venue freeze' using errcode = 'RVLCK';
  end if;
  -- Two taps engage one control.
  select c.id into v_id from public.control_state c
  where c.venue_id = p_venue_id and c.level = p_level and c.released_at is null and c.feature is not distinct from p_feature
    and c.member_id is not distinct from p_member_id and c.staff_id is not distinct from p_staff_id;
  if v_id is not null then return v_id; end if;
  insert into public.control_state (venue_id, level, feature, member_id, staff_id, reason, engaged_by_staff_id)
  values (p_venue_id, p_level, p_feature, p_member_id, p_staff_id, btrim(p_reason), private.current_staff_id(p_venue_id))
  returning id into v_id;
  perform private.emit(p_venue_id, 'control.engaged',
                       jsonb_build_object('control_id', v_id, 'level', p_level, 'feature', p_feature, 'member_id', p_member_id, 'staff_id', p_staff_id),
                       'control.engaged:' || v_id);
  perform private.raise_alert(p_venue_id, 'control.engaged', jsonb_build_object('control_id', v_id, 'level', p_level, 'reason', btrim(p_reason)));
  return v_id;
end;
$$;

-- A super admin releases a control with a reason. A venue freeze takes two: the first call asks (and
-- gives 'awaiting_second'), a second super admin's call releases it. Gives 'released' once released.
create function private.release_control(p_control_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_control public.control_state;
  v_staff uuid;
begin
  select * into v_control from public.control_state c where c.id = p_control_id for update;
  if v_control.id is null or not private.has_permission(v_control.venue_id, 'control.engage') then
    raise exception 'Only a super admin releases the kill switch' using errcode = '42501';
  end if;
  if v_control.released_at is not null then
    raise exception 'That control is not engaged' using errcode = '22023';
  end if;
  v_staff := private.current_staff_id(v_control.venue_id);
  if v_control.level = 'venue_freeze' and v_control.released_by_staff_id is not null then
    if v_control.released_by_staff_id = v_staff then
      raise exception 'A second super admin releases the venue freeze' using errcode = 'RVTWO';
    end if;
    update public.control_state set release_second_staff_id = v_staff, released_at = now() where id = v_control.id;
  else
    if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
      raise exception 'A reason of 3 to 500 characters' using errcode = '22023';
    end if;
    if v_control.level = 'venue_freeze' then
      update public.control_state set released_by_staff_id = v_staff, release_reason = btrim(p_reason) where id = v_control.id;
      perform private.raise_alert(v_control.venue_id, 'control.release_asked',
                                  jsonb_build_object('control_id', v_control.id, 'level', v_control.level, 'reason', btrim(p_reason)));
      return 'awaiting_second';
    end if;
    update public.control_state set released_by_staff_id = v_staff, release_reason = btrim(p_reason), released_at = now() where id = v_control.id;
  end if;
  perform private.emit(v_control.venue_id, 'control.released', jsonb_build_object('control_id', v_control.id, 'level', v_control.level),
                       'control.released:' || v_control.id);
  perform private.raise_alert(v_control.venue_id, 'control.released', jsonb_build_object('control_id', v_control.id, 'level', v_control.level));
  return 'released';
end;
$$;

-- The venue's engaged controls for super admins, newest first: the level and its target, why, who
-- engaged it and when, and for a freeze who asked for its release and why.
create function private.engaged_controls(p_venue_id uuid)
returns table (control_id uuid, level public.control_level, feature public.killable_feature, member_name text, staff_name text, reason text,
               engaged_at timestamptz, engaged_by text, release_asked_by text, release_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.level, c.feature, m.full_name, t.full_name, c.reason, c.engaged_at, e.full_name, a.full_name, c.release_reason
  from public.control_state c
  left join public.member m on m.id = c.member_id
  left join public.staff t on t.id = c.staff_id
  left join public.staff e on e.id = c.engaged_by_staff_id
  left join public.staff a on a.id = c.released_by_staff_id
  where c.venue_id = p_venue_id and c.released_at is null and private.has_permission(p_venue_id, 'control.engage')
  order by c.engaged_at desc;
$$;

revoke execute on function private.engagers(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.engage_control(uuid, public.control_level, text, public.killable_feature, uuid, uuid),
  private.release_control(uuid, text), private.engaged_controls(uuid) from public, anon;
grant execute on function private.engage_control(uuid, public.control_level, text, public.killable_feature, uuid, uuid),
  private.release_control(uuid, text), private.engaged_controls(uuid) to authenticated;

create function public.engage_control(p_venue_id uuid, p_level public.control_level, p_reason text, p_feature public.killable_feature default null,
                                      p_member_id uuid default null, p_staff_id uuid default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.engage_control(p_venue_id, p_level, p_reason, p_feature, p_member_id, p_staff_id); $$;
create function public.release_control(p_control_id uuid, p_reason text default null)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.release_control(p_control_id, p_reason); $$;
create function public.engaged_controls(p_venue_id uuid)
returns table (control_id uuid, level public.control_level, feature public.killable_feature, member_name text, staff_name text, reason text,
               engaged_at timestamptz, engaged_by text, release_asked_by text, release_reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.engaged_controls(p_venue_id); $$;

revoke execute on function public.engage_control(uuid, public.control_level, text, public.killable_feature, uuid, uuid),
  public.release_control(uuid, text), public.engaged_controls(uuid) from public, anon;
grant execute on function public.engage_control(uuid, public.control_level, text, public.killable_feature, uuid, uuid),
  public.release_control(uuid, text), public.engaged_controls(uuid) to authenticated;
