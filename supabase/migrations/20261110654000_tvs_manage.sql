-- A permission for TVs alone (#656; the owner, 3 Nov): pairing TVs, choosing what each shows and unpairing one, for Floor and Cashier as well
-- as super admins and admins. devices.manage stays with those two, as it also enrols the cage's computers and keeps the cameras.
insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['tvs.manage']) as permission;
insert into public.role_permission (role, permission)
select 'admin', permission from unnest(array['tvs.manage']) as permission;
insert into public.role_permission (role, permission)
select 'floor', permission from unnest(array['tvs.manage']) as permission;
insert into public.role_permission (role, permission)
select 'cashier', permission from unnest(array['tvs.manage']) as permission;

create policy "TV managers change TVs" on public.device
  for update to authenticated
  using (kind = 'tv' and venue_id in (select private.venues_where('tvs.manage')))
  with check (kind = 'tv' and venue_id in (select private.venues_where('tvs.manage')));

-- Unpairing a TV writes the row directly, so during a venue freeze it is refused as other direct writes are: otherwise a TV could be taken
-- off the "club closed" screen, and it could not be paired back until the freeze is released.
create trigger refuse_frozen_write before update on public.device
  for each row when (old.kind = 'tv') execute function private.refuse_frozen_write();

-- As in 20261019090700_device_login.sql, and for a TV tvs.manage is enough.
create or replace function private.manageable_device(p_device_id uuid, p_kinds public.device_kind[])
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_device public.device;
begin
  select * into v_device from public.device d where d.id = p_device_id;
  if v_device.id is not null and not private.has_permission(v_device.venue_id, 'devices.manage')
     and not (v_device.kind = 'tv' and private.has_permission(v_device.venue_id, 'tvs.manage')) then
    raise exception 'Only staff who manage devices do this' using errcode = '42501';
  end if;
  if v_device.id is null or v_device.revoked_at is not null or not v_device.kind = any (p_kinds) then
    raise exception 'That device is not here any more, or does not sign in as itself' using errcode = '22023';
  end if;
  return v_device.venue_id;
end;
$$;

-- As they were made, on tvs.manage.
create or replace function private.claim_tv_pairing(p_venue_id uuid, p_code text, p_name text, p_mode public.tv_mode)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pairing_id uuid;
  v_device_id uuid;
begin
  if not private.has_permission(p_venue_id, 'tvs.manage') then
    raise exception 'Only staff who manage devices do this' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  select p.id into v_pairing_id
  from private.tv_pairing p
  where p.code_hash = private.pairing_hash(coalesce(p_code, '')) and p.claimed_at is null and p.expires_at > now()
  for update;
  if v_pairing_id is null then
    raise exception 'No TV is showing that code' using errcode = 'RVCOD';
  end if;
  -- device_guard records the caller as who enrolled it.
  insert into public.device (venue_id, kind, name) values (p_venue_id, 'tv', trim(p_name)) returning id into v_device_id;
  insert into public.tv_screen (device_id, venue_id, mode, set_by_staff_id)
  values (v_device_id, p_venue_id, p_mode, private.current_staff_id(p_venue_id));
  update private.tv_pairing p set device_id = v_device_id, claimed_at = now() where p.id = v_pairing_id;
  perform private.audit(p_venue_id, 'device.paired', 'device', v_device_id::text, null, jsonb_build_object('mode', p_mode));
  return v_device_id;
end;
$$;

create or replace function private.tv_pairing_policy(p_venue_id uuid)
returns table (is_window_only boolean, open_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.tv_pairing_window_only,
         case when c.tv_pairing_window_at > now() - interval '10 minutes' then c.tv_pairing_window_at + interval '10 minutes' end
  from public.venue_config c
  where c.venue_id = p_venue_id and private.has_permission(p_venue_id, 'tvs.manage');
$$;

create or replace function private.open_tv_pairing_window(p_venue_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_venue_id, 'tvs.manage') then
    raise exception 'Only staff who manage devices do this' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  update public.venue_config set tv_pairing_window_at = now() where venue_id = p_venue_id;
  return now() + interval '10 minutes';
end;
$$;
