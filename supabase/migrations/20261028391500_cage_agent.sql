-- The cage agent's enrolment and identity (#168, #123; decision 0260). Staff who manage devices add it on the Computers
-- screen as they add a computer, and read its six-digit code to the agent. The agent, signed out, claims the code
-- through the cage-agent function with the hash of a token it keeps; wrong codes count against the address they come
-- from, as a tablet's pairing does. From then on it is known by that token alone, and may only fetch its venue's
-- offline pack and print its KOTs: computer_kind_for is unchanged, so it never unlocks the cage's or an admin's work.
alter table public.device drop constraint device_token_only_computers;
alter table public.device add constraint device_token_only_computers check (token_hash is null or kind in ('cage', 'console', 'agent'));

-- As before (20261020170000_cage_computers.sql), with the cage agent among what may be added.
create or replace function private.add_computer(p_venue_id uuid, p_kind public.device_kind, p_name text)
returns table (device_id uuid, code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_device_id uuid;
  v_code text;
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'devices.manage') then
    raise exception 'Only staff who manage devices add a computer' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('cage', 'console', 'agent') then
    raise exception 'A computer is enrolled as the cage, an admin console or the cage agent' using errcode = '22023';
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
$$;

-- The agent claims its code, signed out, with the hash of its token: the device and venue, or why not. Five wrong codes
-- from one address in ten minutes stop it for ten minutes (too_many), as a tablet's pairing.
create function private.claim_agent(p_code text, p_token_hash text, p_client text)
returns table (device_id uuid, venue_id uuid, refusal text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_client text := 'agent:' || coalesce(p_client, '');
  v_enrolment public.computer_enrolment;
begin
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'The token''s hash is 64 hex digits' using errcode = '22023';
  end if;
  delete from private.device_pairing_miss m where m.missed_at < now() - interval '1 day';
  if (select count(*) from private.device_pairing_miss m where m.client = v_client and m.missed_at > now() - interval '10 minutes') >= 5 then
    return query select null::uuid, null::uuid, 'too_many'::text;
    return;
  end if;
  select e.* into v_enrolment from public.computer_enrolment e join public.device d on d.id = e.device_id
  where e.code_hash = private.pairing_hash(coalesce(p_code, '')) and e.claimed_at is null and e.expires_at > now()
    and d.kind = 'agent' and d.revoked_at is null
  for update of e;
  if v_enrolment.id is null then
    insert into private.device_pairing_miss (client) values (v_client);
    return query select null::uuid, null::uuid, 'wrong_code'::text;
    return;
  end if;
  update public.device d set token_hash = p_token_hash where d.id = v_enrolment.device_id;
  update public.computer_enrolment e set claimed_at = now() where e.id = v_enrolment.id;
  perform private.audit(v_enrolment.venue_id, 'device.enrolled', 'device', v_enrolment.device_id::text, null, null);
  return query select v_enrolment.device_id, v_enrolment.venue_id, null::text;
end;
$$;

-- The agent a token belongs to, while it is not revoked: its device and venue, or nothing.
create function private.agent_device(p_token_hash text)
returns table (device_id uuid, venue_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.venue_id from public.device d
  where d.kind = 'agent' and d.revoked_at is null and d.token_hash = p_token_hash
    and not exists (select 1 from public.control_state c where c.level = 'access_revoke' and c.device_id = d.id and c.released_at is null);
$$;

create function public.claim_agent(p_code text, p_token_hash text, p_client text)
returns table (device_id uuid, venue_id uuid, refusal text)
language sql volatile security invoker set search_path = ''
as $$ select * from private.claim_agent(p_code, p_token_hash, p_client); $$;
create function public.agent_device(p_token_hash text)
returns table (device_id uuid, venue_id uuid)
language sql stable security invoker set search_path = ''
as $$ select * from private.agent_device(p_token_hash); $$;

revoke execute on function private.claim_agent(text, text, text), private.agent_device(text), public.claim_agent(text, text, text),
  public.agent_device(text) from public, anon, authenticated;
grant execute on function private.claim_agent(text, text, text), private.agent_device(text), public.claim_agent(text, text, text),
  public.agent_device(text) to service_role;
