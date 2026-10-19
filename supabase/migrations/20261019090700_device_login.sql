-- A dealer tablet signs in as itself and is fixed to one table (#41, scope-v1 module 4); TVs (#49)
-- will pair the same way. Staff with devices.manage enrol the tablet on the console and read out a
-- six-digit pairing code, valid for ten minutes. The tablet sends the code to the device-pair Edge
-- Function, which redeems it here and gives the device its own Auth login: a phone number in +999,
-- a country code no phone has, and a random password nobody ever sees. The function signs that login
-- in once and hands the tablet the session. A device login is password-only and reaches only what
-- current_device_id() opens; revoking the device unlinks it for good, and pairing it again replaces it.

-- Auth's token hook (#187), with the device rule it was waiting for. A device's login gets a token
-- only from its password, only while the device is linked, not revoked and its access not revoked:
-- never from a code, so a device login moved onto someone's phone is useless. Everyone else needs a
-- code sign-in, as before. Security definer, so Auth reads the device without any other grant.
create or replace function private.require_code_sign_in(event jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.device d where d.auth_user_id::text = event ->> 'user_id') then
      case
        when jsonb_path_exists(event, '$.claims.amr[*] ? (@.method == "password")')
         and not jsonb_path_exists(event, '$.claims.amr[*] ? (@.method != "password")')
         and exists (select 1 from public.device d
                     where d.auth_user_id::text = event ->> 'user_id' and d.revoked_at is null
                       and not exists (select 1 from public.control_state c
                                       where c.level = 'access_revoke' and c.device_id = d.id and c.released_at is null))
        then event
        else jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'This device is not paired.'))
      end
    -- Lax JSON path: an amr that is missing or null, or holds no otp method, matches nothing.
    when jsonb_path_exists(event, '$.claims.amr[*] ? (@.method == "otp")') then event
    else jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', 'Sign in with the code sent to your phone.')
    )
  end
$$;

comment on function private.require_code_sign_in(jsonb) is
  'Auth''s Custom Access Token hook: a token only for a code sign-in (#187), or a paired device''s password login (#41).';

-- Devices, as lane 0 grants them to staff: who enrolled one is the caller, never a value sent; an
-- enrolment waits out a venue freeze; a revoked device stays revoked (enrol it again) and its login
-- is unlinked and its table freed at once, so nothing brings the old sessions back.
create function private.guard_device()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.assert_writable(new.venue_id);
    new.enrolled_by_staff_id := private.current_staff_id(new.venue_id);
    return new;
  end if;
  if old.revoked_at is not null and (new.revoked_at, new.revoked_reason) is distinct from (old.revoked_at, old.revoked_reason) then
    raise exception 'A revoked device stays revoked; enrol it again' using errcode = '22023';
  end if;
  if old.revoked_at is null and new.revoked_at is not null then
    new.auth_user_id := null;
    delete from public.tablet_assignment a where a.device_id = new.id;
  end if;
  return new;
end;
$$;

create trigger device_guard before insert or update on public.device
  for each row execute function private.guard_device();

-- Pairing codes, by hash: the code itself is shown once, on the console. The hash only keeps the
-- code out of plain sight; with a million codes it is no secret, so no client role reads the table.
create table public.device_pairing (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  device_id uuid not null,
  code_hash text not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.device_pairing is 'A device''s pairing codes, by hash. Only the functions below read or write them.';

alter table public.device add constraint device_id_venue_id_key unique (id, venue_id);
alter table public.device_pairing add constraint device_pairing_device_fkey
  foreign key (device_id, venue_id) references public.device (id, venue_id);
create index device_pairing_device_idx on public.device_pairing (device_id, venue_id);
create index device_pairing_venue_idx on public.device_pairing (venue_id);
create index device_pairing_staff_idx on public.device_pairing (created_by_staff_id);
create index device_pairing_live_idx on public.device_pairing (code_hash) where redeemed_at is null;
create trigger device_pairing_touch_updated_at before update on public.device_pairing
  for each row execute function private.touch_updated_at();
alter table public.device_pairing enable row level security;

-- Wrong codes sent to device-pair, by the address they came from, for its limits. Not personal data
-- beyond the address, and kept only for the window the limits look at.
create table private.device_pairing_miss (
  id bigint generated always as identity primary key,
  client text not null,
  missed_at timestamptz not null default now()
);

create index device_pairing_miss_client_idx on private.device_pairing_miss (client, missed_at);
create index device_pairing_miss_at_idx on private.device_pairing_miss (missed_at);
alter table private.device_pairing_miss enable row level security;

-- The table a dealer tablet is fixed to: one tablet per table, one table per tablet.
create table public.tablet_assignment (
  device_id uuid primary key,
  venue_id uuid not null,
  table_id uuid not null unique,
  assigned_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (device_id, venue_id) references public.device (id, venue_id),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id)
);

comment on table public.tablet_assignment is 'The table each dealer tablet is fixed to (#41).';

create index tablet_assignment_device_venue_idx on public.tablet_assignment (device_id, venue_id);
create index tablet_assignment_table_venue_idx on public.tablet_assignment (table_id, venue_id);
create index tablet_assignment_venue_idx on public.tablet_assignment (venue_id);
create index tablet_assignment_staff_idx on public.tablet_assignment (assigned_by_staff_id);
create trigger tablet_assignment_touch_updated_at before update on public.tablet_assignment
  for each row execute function private.touch_updated_at();
create trigger tablet_assignment_audit after insert or update or delete on public.tablet_assignment
  for each row execute function private.audit_row_change();
alter table public.tablet_assignment enable row level security;
grant select on public.tablet_assignment to authenticated;

create policy "staff and the tablet see tablet assignments" on public.tablet_assignment
  for select to authenticated
  using (venue_id in (select private.staff_venues()) or device_id = (select private.current_device_id()));

create function private.pairing_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to('rivr-device-pairing:' || p_code, 'UTF8'), 'sha256'), 'hex');
$$;

-- A device that signs in as itself, for staff with devices.manage at its venue: its venue, or why not.
-- No such device and a revoked one are 22023 (the list changed); the wrong role is 42501.
create function private.manageable_device(p_device_id uuid, p_kinds public.device_kind[])
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
  if v_device.id is not null and not private.has_permission(v_device.venue_id, 'devices.manage') then
    raise exception 'Only staff who manage devices do this' using errcode = '42501';
  end if;
  if v_device.id is null or v_device.revoked_at is not null or not v_device.kind = any (p_kinds) then
    raise exception 'That device is not here any more, or does not sign in as itself' using errcode = '22023';
  end if;
  return v_device.venue_id;
end;
$$;

-- Staff with devices.manage start pairing a dealer tablet or TV, or pair one again: a new six-digit
-- code for ten minutes, and any code given out before stops working. This is the only time the code
-- is seen. Pairing again leaves the device's current login working until the new code is redeemed.
create function private.start_device_pairing(p_device_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.manageable_device(p_device_id, array['dealer_tablet', 'tv']::public.device_kind[]);
  v_code text;
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  perform private.assert_writable(v_venue_id);
  update public.device_pairing p set expires_at = now()
  where p.device_id = p_device_id and p.redeemed_at is null and p.expires_at > now();
  -- From a strong random source, and never the same as another live code.
  loop
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.device_pairing p
                          where p.code_hash = private.pairing_hash(v_code) and p.redeemed_at is null and p.expires_at > now());
  end loop;
  insert into public.device_pairing (venue_id, device_id, code_hash, expires_at, created_by_staff_id)
  values (v_venue_id, p_device_id, private.pairing_hash(v_code), v_expires_at, private.current_staff_id(v_venue_id));
  perform private.audit(v_venue_id, 'device.pairing_started', 'device', p_device_id::text, null,
                        jsonb_build_object('expires_at', v_expires_at));
  return query select v_code, v_expires_at;
end;
$$;

-- device-pair redeems a code (the service role only), for a client address. A right code is used up
-- and names the device, and the login it had if device-pair made it (so only that one is removed).
-- Wrong codes are counted by address: five in ten minutes from one address, or fifty from all, and
-- every redemption is refused until the window passes (`too_many`), with an alert for the owner.
create function private.redeem_device_pairing(p_code text, p_client text)
returns table (device_id uuid, previous_user_id uuid, refusal text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pairing public.device_pairing;
  v_client text := coalesce(nullif(trim(p_client), ''), 'unknown');
begin
  -- One redemption at a time, so the limits hold under a burst.
  perform pg_advisory_xact_lock(hashtext('device-pairing'));
  delete from private.device_pairing_miss m where m.missed_at < now() - interval '1 day';
  if (select count(*) from private.device_pairing_miss m where m.client = v_client and m.missed_at > now() - interval '10 minutes') >= 5
     or (select count(*) from private.device_pairing_miss m where m.missed_at > now() - interval '10 minutes') >= 50 then
    perform private.raise_pairing_alert();
    return query select null::uuid, null::uuid, 'too_many'::text;
    return;
  end if;
  select p.* into v_pairing
  from public.device_pairing p
  join public.device d on d.id = p.device_id and d.revoked_at is null
  where p.code_hash = private.pairing_hash(coalesce(p_code, '')) and p.redeemed_at is null and p.expires_at > now();
  if v_pairing.id is null then
    insert into private.device_pairing_miss (client) values (v_client);
    return query select null::uuid, null::uuid, 'wrong_code'::text;
    return;
  end if;
  update public.device_pairing p set redeemed_at = now() where p.id = v_pairing.id;
  perform private.audit(v_pairing.venue_id, 'device.paired', 'device', v_pairing.device_id::text, null,
                        jsonb_build_object('pairing_started_by_staff_id', v_pairing.created_by_staff_id));
  return query
    select d.id,
           (select u.id from auth.users u
            where u.id = d.auth_user_id and u.raw_app_meta_data ->> 'device_id' = d.id::text),
           null::text
    from public.device d where d.id = v_pairing.device_id;
end;
$$;

-- An alert for the owner when wrong pairing codes hit the limits: at most one every 15 minutes.
create function private.raise_pairing_alert()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select v.id from public.venue v where not v.is_practice order by v.created_at limit 1);
begin
  if v_venue_id is null or exists (select 1 from public.alert a where a.venue_id = v_venue_id
                                   and a.kind = 'devices.pairing_guessed' and a.raised_at > now() - interval '15 minutes') then
    return;
  end if;
  insert into public.alert (venue_id, kind, detail)
  values (v_venue_id, 'devices.pairing_guessed',
          jsonb_build_object('note', 'Many wrong pairing codes: pairing a tablet or TV is paused for up to ten minutes.'));
end;
$$;

-- device-pair links the device to the login it just made (the service role only). False when the
-- device was revoked in the meantime, and the function then removes the login.
create function private.link_device_login(p_device_id uuid, p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.device d set auth_user_id = p_user_id, last_seen_at = now()
  where d.id = p_device_id and d.revoked_at is null;
  return found;
end;
$$;

-- Staff with devices.manage fix a dealer tablet to one of the venue's tables. A tablet fixed to that
-- table before is freed, and so is the table this tablet had.
create function private.assign_tablet(p_device_id uuid, p_table_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.manageable_device(p_device_id, array['dealer_tablet']::public.device_kind[]);
begin
  perform private.assert_writable(v_venue_id);
  if not exists (select 1 from public.game_table t where t.id = p_table_id and t.venue_id = v_venue_id) then
    raise exception 'That table is not at this venue' using errcode = '22023';
  end if;
  delete from public.tablet_assignment a where a.table_id = p_table_id and a.device_id <> p_device_id;
  insert into public.tablet_assignment (device_id, venue_id, table_id, assigned_by_staff_id)
  values (p_device_id, v_venue_id, p_table_id, private.current_staff_id(v_venue_id))
  on conflict on constraint tablet_assignment_pkey
  do update set table_id = excluded.table_id, assigned_by_staff_id = excluded.assigned_by_staff_id;
end;
$$;

-- The signed-in device: its name and the table it is fixed to, if any. Nothing for anyone else.
create function private.my_device()
returns table (device_id uuid, venue_id uuid, name text, kind public.device_kind, table_id uuid, table_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.venue_id, d.name, d.kind, t.id, t.name
  from public.device d
  left join public.tablet_assignment a on a.device_id = d.id
  left join public.game_table t on t.id = a.table_id
  where d.id = (select private.current_device_id());
$$;

revoke execute on function private.guard_device(), private.pairing_hash(text), private.manageable_device(uuid, public.device_kind[]),
  private.redeem_device_pairing(text, text), private.raise_pairing_alert(), private.link_device_login(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.redeem_device_pairing(text, text), private.link_device_login(uuid, uuid) to service_role;
grant execute on function private.start_device_pairing(uuid), private.assign_tablet(uuid, uuid), private.my_device() to authenticated;

create function public.start_device_pairing(p_device_id uuid)
returns table (code text, expires_at timestamptz)
language sql volatile security invoker set search_path = ''
as $$ select * from private.start_device_pairing(p_device_id); $$;

create function public.redeem_device_pairing(p_code text, p_client text)
returns table (device_id uuid, previous_user_id uuid, refusal text)
language sql volatile security invoker set search_path = ''
as $$ select * from private.redeem_device_pairing(p_code, p_client); $$;

create function public.link_device_login(p_device_id uuid, p_user_id uuid)
returns boolean
language sql volatile security invoker set search_path = ''
as $$ select private.link_device_login(p_device_id, p_user_id); $$;

create function public.assign_tablet(p_device_id uuid, p_table_id uuid)
returns void
language sql volatile security invoker set search_path = ''
as $$ select private.assign_tablet(p_device_id, p_table_id); $$;

create function public.my_device()
returns table (device_id uuid, venue_id uuid, name text, kind public.device_kind, table_id uuid, table_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_device(); $$;

revoke execute on function public.start_device_pairing(uuid), public.redeem_device_pairing(text, text), public.link_device_login(uuid, uuid),
  public.assign_tablet(uuid, uuid), public.my_device() from public, anon;
revoke execute on function public.redeem_device_pairing(text, text), public.link_device_login(uuid, uuid) from authenticated;
grant execute on function public.redeem_device_pairing(text, text), public.link_device_login(uuid, uuid) to service_role;
grant execute on function public.start_device_pairing(uuid), public.assign_tablet(uuid, uuid), public.my_device() to authenticated;
