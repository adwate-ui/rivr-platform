-- The cage agent is gone (20261120500100_cage_agent_removed.sql), so a computer is enrolled as the cage or an admin
-- console only (#1019): add_computer refuses the kind `agent`, and only those two kinds hold a token. The kind stays in
-- the enum for the revoked agents' rows; their tokens, dead since the agent went, are cleared.
update public.device set token_hash = null where kind = 'agent' and token_hash is not null;
alter table public.device drop constraint device_token_only_computers;
alter table public.device add constraint device_token_only_computers check (token_hash is null or kind in ('cage', 'console'));

-- Otherwise as 20261028391500_cage_agent.sql made it.
CREATE OR REPLACE FUNCTION private.add_computer(p_venue_id uuid, p_kind device_kind, p_name text)
 RETURNS TABLE(device_id uuid, code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_device_id uuid;
  v_code text;
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'devices.manage') then
    raise exception 'Only staff who manage devices add a computer' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('cage', 'console') then
    raise exception 'A computer is enrolled as the cage or an admin console' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  insert into public.device (venue_id, kind, name) values (p_venue_id, p_kind, trim(coalesce(p_name, ''))) returning id into v_device_id;
  -- From a strong random source, and never the same as another live code, as a tablet's pairing code.
  loop
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.computer_enrolment e
                          where e.code_hash = private.pairing_hash(v_code) and e.claimed_at is null and e.expires_at > now());
  end loop;
  insert into public.computer_enrolment (venue_id, device_id, code_hash, expires_at, created_by_staff_id)
  values (p_venue_id, v_device_id, private.pairing_hash(v_code), v_expires_at, private.current_staff_id(p_venue_id));
  perform private.audit(p_venue_id, 'device.enrolment_started', 'device', v_device_id::text, null, jsonb_build_object('expires_at', v_expires_at));
  return query select v_device_id, v_code, v_expires_at;
end;
$function$;
