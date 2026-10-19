-- TVs pair the other way round from dealer tablets (#49, additions "TV pairing"). A TV that is not
-- paired asks device-pair for a six-digit code and shows it; staff with devices.manage type that
-- code into the console with the TV's name and display mode, which enrols the TV as a device. The TV
-- asks device-pair every few seconds with a secret only it holds; once its code is claimed,
-- device-pair gives it its own login, as a tablet gets one (#41, decision 0045). A TV holds no
-- state: what it shows comes from tv_screen, and revoking the device unpairs it.

create type public.tv_mode as enum (
  'waitlist', 'call_time', 'jackpot', 'tournament_clock', 'promotions', 'rewards', 'league', 'social_wall', 'spin_wheel'
);

comment on type public.tv_mode is 'What a TV shows (additions "TV modes").';

-- A TV's request to be paired: the code it shows and the secret it asks with, both by hash, for
-- fifteen minutes. Claimed, it names the device the console enrolled; delivered, the TV has its
-- login. A request belongs to no venue until it is claimed, so it sits in private, beside
-- device_pairing_miss: no client role reads it, and each new request deletes rows a day old.
create table private.tv_pairing (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  secret_hash text not null unique,
  client text not null,
  expires_at timestamptz not null,
  device_id uuid references public.device (id),
  claimed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  check ((device_id is null) = (claimed_at is null)),
  check (delivered_at is null or claimed_at is not null)
);

create index tv_pairing_live_idx on private.tv_pairing (code_hash) where claimed_at is null;
create index tv_pairing_client_idx on private.tv_pairing (client, created_at);
create index tv_pairing_created_idx on private.tv_pairing (created_at);
create index tv_pairing_expires_idx on private.tv_pairing (expires_at);
create index tv_pairing_device_idx on private.tv_pairing (device_id);
alter table private.tv_pairing enable row level security;

-- What each TV shows. Written only by the functions below; staff at the venue and the TV itself read it.
create table public.tv_screen (
  device_id uuid primary key,
  venue_id uuid not null,
  mode public.tv_mode not null,
  set_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (device_id, venue_id) references public.device (id, venue_id)
);

comment on table public.tv_screen is 'The display mode each TV shows (#49).';

create index tv_screen_device_venue_idx on public.tv_screen (device_id, venue_id);
create index tv_screen_venue_idx on public.tv_screen (venue_id);
create index tv_screen_staff_idx on public.tv_screen (set_by_staff_id);
create trigger tv_screen_touch_updated_at before update on public.tv_screen
  for each row execute function private.touch_updated_at();
create trigger tv_screen_audit after insert or update or delete on public.tv_screen
  for each row execute function private.audit_row_change();
alter table public.tv_screen enable row level security;
grant select on public.tv_screen to authenticated;

create policy "staff and the TV see TV screens" on public.tv_screen
  for select to authenticated
  using (venue_id in (select private.staff_venues()) or device_id = (select private.current_device_id()));

-- device-pair asks for a TV's code (the service role only), for a client address: six digits no
-- live request has, and a secret for the TV to ask with, for fifteen minutes. Thirty requests from
-- one address in ten minutes (a venue's TVs share one address, and each reload asks again), or two
-- hundred from all, and it refuses (`too_many`) until the window passes. So a stranger holds few of
-- the million codes, and a code typed wrong on the console is very unlikely to be theirs.
create function private.start_tv_pairing(p_client text)
returns table (code text, secret text, expires_at timestamptz, refusal text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_client text := coalesce(nullif(trim(p_client), ''), 'unknown');
  v_code text;
  v_secret text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := now() + interval '15 minutes';
begin
  -- One request at a time, so the limits hold under a burst.
  perform pg_advisory_xact_lock(hashtext('tv-pairing'));
  delete from private.tv_pairing p where p.expires_at < now() - interval '1 day';
  if (select count(*) from private.tv_pairing p where p.client = v_client and p.created_at > now() - interval '10 minutes') >= 30
     or (select count(*) from private.tv_pairing p where p.created_at > now() - interval '10 minutes') >= 200 then
    return query select null::text, null::text, null::timestamptz, 'too_many'::text;
    return;
  end if;
  loop
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from private.tv_pairing p
                          where p.code_hash = private.pairing_hash(v_code) and p.claimed_at is null and p.expires_at > now());
  end loop;
  insert into private.tv_pairing (code_hash, secret_hash, client, expires_at)
  values (private.pairing_hash(v_code), private.pairing_hash(v_secret), v_client, v_expires_at);
  return query select v_code, v_secret, v_expires_at, null::text;
end;
$$;

-- Staff with devices.manage claim the code a TV shows: the TV is enrolled at their venue with its
-- name and mode, and device-pair signs it in when it next asks. A code that is wrong, run out or
-- claimed already is RVCOD. The code is claimed once, even by two consoles at the same moment.
create function private.claim_tv_pairing(p_venue_id uuid, p_code text, p_name text, p_mode public.tv_mode)
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
  if not private.has_permission(p_venue_id, 'devices.manage') then
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

-- device-pair asks on a TV's behalf with its secret (the service role only): the device, once its
-- code is claimed, and once only, so the secret signs nothing in after that; `waiting` while the
-- code is live and unclaimed; `expired` for a secret that is unknown, run out or used.
create function private.check_tv_pairing(p_secret text)
returns table (device_id uuid, refusal text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_secret_hash text := private.pairing_hash(coalesce(p_secret, ''));
  v_device_id uuid;
begin
  update private.tv_pairing p set delivered_at = now()
  where p.secret_hash = v_secret_hash and p.claimed_at is not null and p.delivered_at is null
  returning p.device_id into v_device_id;
  if v_device_id is not null then
    return query select v_device_id, null::text;
    return;
  end if;
  return query
    select null::uuid,
           case when exists (select 1 from private.tv_pairing p
                             where p.secret_hash = v_secret_hash and p.claimed_at is null and p.expires_at > now())
                then 'waiting' else 'expired' end;
end;
$$;

-- Staff with devices.manage change what a TV shows.
create function private.set_tv_mode(p_device_id uuid, p_mode public.tv_mode)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.manageable_device(p_device_id, array['tv']::public.device_kind[]);
begin
  perform private.assert_writable(v_venue_id);
  insert into public.tv_screen (device_id, venue_id, mode, set_by_staff_id)
  values (p_device_id, v_venue_id, p_mode, private.current_staff_id(v_venue_id))
  on conflict on constraint tv_screen_pkey
  do update set mode = excluded.mode, set_by_staff_id = excluded.set_by_staff_id;
end;
$$;

-- The signed-in TV: its name and what it shows. Nothing for anyone else, or for a TV since revoked,
-- which then signs itself out and shows a new code.
create function private.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, mode public.tv_mode)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.venue_id, d.name, s.mode
  from public.device d
  join public.tv_screen s on s.device_id = d.id
  where d.id = (select private.current_device_id()) and d.kind = 'tv';
$$;

revoke execute on function private.start_tv_pairing(text), private.check_tv_pairing(text),
  private.claim_tv_pairing(uuid, text, text, public.tv_mode), private.set_tv_mode(uuid, public.tv_mode), private.my_tv_screen()
  from public, anon;
revoke execute on function private.start_tv_pairing(text), private.check_tv_pairing(text) from authenticated;
grant execute on function private.start_tv_pairing(text), private.check_tv_pairing(text) to service_role;
grant execute on function private.claim_tv_pairing(uuid, text, text, public.tv_mode), private.set_tv_mode(uuid, public.tv_mode),
  private.my_tv_screen() to authenticated;

create function public.start_tv_pairing(p_client text)
returns table (code text, secret text, expires_at timestamptz, refusal text)
language sql volatile security invoker set search_path = ''
as $$ select * from private.start_tv_pairing(p_client); $$;

create function public.check_tv_pairing(p_secret text)
returns table (device_id uuid, refusal text)
language sql volatile security invoker set search_path = ''
as $$ select * from private.check_tv_pairing(p_secret); $$;

create function public.claim_tv_pairing(p_venue_id uuid, p_code text, p_name text, p_mode public.tv_mode)
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.claim_tv_pairing(p_venue_id, p_code, p_name, p_mode); $$;

create function public.set_tv_mode(p_device_id uuid, p_mode public.tv_mode)
returns void
language sql volatile security invoker set search_path = ''
as $$ select private.set_tv_mode(p_device_id, p_mode); $$;

create function public.my_tv_screen()
returns table (device_id uuid, venue_id uuid, name text, mode public.tv_mode)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tv_screen(); $$;

revoke execute on function public.start_tv_pairing(text), public.check_tv_pairing(text),
  public.claim_tv_pairing(uuid, text, text, public.tv_mode), public.set_tv_mode(uuid, public.tv_mode), public.my_tv_screen()
  from public, anon;
revoke execute on function public.start_tv_pairing(text), public.check_tv_pairing(text) from authenticated;
grant execute on function public.start_tv_pairing(text), public.check_tv_pairing(text) to service_role;
grant execute on function public.claim_tv_pairing(uuid, text, text, public.tv_mode), public.set_tv_mode(uuid, public.tv_mode),
  public.my_tv_screen() to authenticated;
