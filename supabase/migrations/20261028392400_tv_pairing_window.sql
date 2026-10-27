-- TV pairing (#325; the owner's answer to #311, decision 0049): a TV still gets a code on first load; when the limit for
-- all screens together is hit, the owner is alerted (raise_pairing_alert, as for wrong tablet codes); and the owner can
-- switch a venue to window-only pairing, where a TV gets a code only within ten minutes of staff with devices.manage
-- pressing Pair a TV, and otherwise says to press it. Switching back restores codes on first load. Both are kept on
-- venue_config, whose every change is audited.
alter table public.venue_config add column tv_pairing_window_only boolean not null default false,
  add column tv_pairing_window_at timestamptz;

create or replace function private.start_tv_pairing(p_client text)
returns table (code text, secret text, expires_at timestamptz, refusal text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_client text := private.pairing_client(p_client);
  v_code text;
  v_secret text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := now() + interval '15 minutes';
begin
  -- One request at a time, so the limits hold under a burst.
  perform pg_advisory_xact_lock(hashtext('tv-pairing'));
  delete from private.tv_pairing p where p.expires_at < now() - interval '1 day';
  if (select count(*) from private.tv_pairing p where p.client = v_client and p.created_at > now() - interval '10 minutes') >= 30 then
    return query select null::text, null::text, null::timestamptz, 'too_many'::text;
    return;
  end if;
  -- The limit for all screens together: the owner is alerted, as for wrong tablet codes.
  if (select count(*) from private.tv_pairing p where p.created_at > now() - interval '10 minutes') >= 200 then
    perform private.raise_pairing_alert();
    return query select null::text, null::text, null::timestamptz, 'too_many'::text;
    return;
  end if;
  -- Window-only pairing: a venue that has it gives codes only for ten minutes after staff press Pair a TV. A screen not
  -- yet paired has no venue, so a window at any club venue opens codes.
  if exists (select 1 from public.venue_config c join public.venue v on v.id = c.venue_id where c.tv_pairing_window_only and not v.is_practice)
     and not exists (select 1 from public.venue_config c where c.tv_pairing_window_only and c.tv_pairing_window_at > now() - interval '10 minutes') then
    return query select null::text, null::text, null::timestamptz, 'window_closed'::text;
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

-- Whether the venue pairs TVs only in a window, and until when one is open, for staff who manage devices.
create function private.tv_pairing_policy(p_venue_id uuid)
returns table (is_window_only boolean, open_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.tv_pairing_window_only,
         case when c.tv_pairing_window_at > now() - interval '10 minutes' then c.tv_pairing_window_at + interval '10 minutes' end
  from public.venue_config c
  where c.venue_id = p_venue_id and private.has_permission(p_venue_id, 'devices.manage');
$$;

-- The owner (venue.configure) switches window-only pairing on or off; either closes any open window.
create function private.set_tv_pairing_window_only(p_venue_id uuid, p_is_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_venue_id, 'venue.configure') then
    raise exception 'Only the owner switches how TVs pair' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  update public.venue_config set tv_pairing_window_only = coalesce(p_is_on, false), tv_pairing_window_at = null where venue_id = p_venue_id;
end;
$$;

-- Staff who manage devices press Pair a TV: for ten minutes, a TV gets a code. When the window closes.
create function private.open_tv_pairing_window(p_venue_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_venue_id, 'devices.manage') then
    raise exception 'Only staff who manage devices do this' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  update public.venue_config set tv_pairing_window_at = now() where venue_id = p_venue_id;
  return now() + interval '10 minutes';
end;
$$;

create function public.tv_pairing_policy(p_venue_id uuid)
returns table (is_window_only boolean, open_until timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_pairing_policy(p_venue_id); $$;
create function public.set_tv_pairing_window_only(p_venue_id uuid, p_is_on boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_tv_pairing_window_only(p_venue_id, p_is_on); $$;
create function public.open_tv_pairing_window(p_venue_id uuid)
returns timestamptz language sql volatile security invoker set search_path = ''
as $$ select private.open_tv_pairing_window(p_venue_id); $$;

revoke execute on function private.tv_pairing_policy(uuid), private.set_tv_pairing_window_only(uuid, boolean), private.open_tv_pairing_window(uuid),
  public.tv_pairing_policy(uuid), public.set_tv_pairing_window_only(uuid, boolean), public.open_tv_pairing_window(uuid) from public, anon;
grant execute on function private.tv_pairing_policy(uuid), private.set_tv_pairing_window_only(uuid, boolean), private.open_tv_pairing_window(uuid),
  public.tv_pairing_policy(uuid), public.set_tv_pairing_window_only(uuid, boolean), public.open_tv_pairing_window(uuid) to authenticated;
