-- Pairing a TV (the owner, 22 Nov): several boards picked at once, the first its main one and the rest the boards it turns
-- to; the tables its call time board shows, picked as it pairs or later on its row (none picked is every table), so one TV
-- shows tables 1 to 3 and another 4 to 6; and no more window-only pairing: every TV not yet paired shows its code at once.

-- The tables a TV's call time board shows; none is every table. Each a table of the TV's venue (checked as they are set).
alter table public.tv_screen
  add column tables uuid[] not null default '{}'
    check (cardinality(tables) <= 50 and array_position(tables, null) is null);
comment on column public.tv_screen.tables is 'The tables the TV''s call time board shows; none is every table (the owner, 22 Nov).';

-- A list of tables for a TV: each once, each a table of the venue. 22023 otherwise.
create function private.assert_tv_tables(p_venue_id uuid, p_tables uuid[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_tables is null or cardinality(p_tables) > 50 or array_position(p_tables, null) is not null
     or cardinality(p_tables) <> (select count(distinct t) from unnest(p_tables) t)
     or exists (select 1 from unnest(p_tables) t
                where not exists (select 1 from public.game_table g where g.id = t and g.venue_id = p_venue_id)) then
    raise exception 'A TV''s tables are the venue''s, each once' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.assert_tv_tables(uuid, uuid[]) from public, anon, authenticated;

-- Pairing takes the boards in order (the first the main one) and the tables. Refusals as before: 42501 not allowed, RVCOD no
-- TV showing that code, RVFRZ the venue frozen; 22023 boards not one to five, each once, or tables not the venue's.
drop function public.claim_tv_pairing(uuid, text, text, public.tv_mode);
drop function private.claim_tv_pairing(uuid, text, text, public.tv_mode);
create function private.claim_tv_pairing(p_venue_id uuid, p_code text, p_name text, p_boards public.tv_mode[], p_tables uuid[])
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
  if p_boards is null or cardinality(p_boards) not between 1 and 5 or array_position(p_boards, null) is not null
     or cardinality(p_boards) <> (select count(distinct b) from unnest(p_boards) b) then
    raise exception 'A TV shows one to five boards, each once' using errcode = '22023';
  end if;
  perform private.assert_tv_tables(p_venue_id, p_tables);
  select p.id into v_pairing_id
  from private.tv_pairing p
  where p.code_hash = private.pairing_hash(coalesce(p_code, '')) and p.claimed_at is null and p.expires_at > now()
  for update;
  if v_pairing_id is null then
    raise exception 'No TV is showing that code' using errcode = 'RVCOD';
  end if;
  -- device_guard records the caller as who enrolled it.
  insert into public.device (venue_id, kind, name) values (p_venue_id, 'tv', trim(p_name)) returning id into v_device_id;
  insert into public.tv_screen (device_id, venue_id, mode, rotation, tables, set_by_staff_id)
  values (v_device_id, p_venue_id, p_boards[1], p_boards[2:], p_tables, private.current_staff_id(p_venue_id));
  update private.tv_pairing p set device_id = v_device_id, claimed_at = now() where p.id = v_pairing_id;
  perform private.audit(p_venue_id, 'device.paired', 'device', v_device_id::text, null,
                        jsonb_build_object('mode', p_boards[1], 'rotation', p_boards[2:], 'tables', p_tables));
  return v_device_id;
end;
$$;
create function public.claim_tv_pairing(p_venue_id uuid, p_code text, p_name text, p_boards public.tv_mode[], p_tables uuid[])
returns uuid
language sql volatile security invoker set search_path = ''
as $$ select private.claim_tv_pairing(p_venue_id, p_code, p_name, p_boards, p_tables); $$;
revoke all on function private.claim_tv_pairing(uuid, text, text, public.tv_mode[], uuid[]) from public, anon;
grant execute on function private.claim_tv_pairing(uuid, text, text, public.tv_mode[], uuid[]) to authenticated;
revoke all on function public.claim_tv_pairing(uuid, text, text, public.tv_mode[], uuid[]) from public, anon;
grant execute on function public.claim_tv_pairing(uuid, text, text, public.tv_mode[], uuid[]) to authenticated;

-- The tables a paired TV's call time board shows, changed on its row. 42501 not allowed, 22023 not the venue's or not a TV.
create function private.set_tv_tables(p_device_id uuid, p_tables uuid[])
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
  perform private.assert_tv_tables(v_venue_id, p_tables);
  update public.tv_screen s set tables = p_tables, set_by_staff_id = private.current_staff_id(v_venue_id) where s.device_id = p_device_id;
  if not found then
    raise exception 'Tables are set on a paired TV' using errcode = '22023';
  end if;
end;
$$;
create function public.set_tv_tables(p_device_id uuid, p_tables uuid[])
returns void
language sql volatile security invoker set search_path = ''
as $$ select private.set_tv_tables(p_device_id, p_tables); $$;
revoke all on function private.set_tv_tables(uuid, uuid[]) from public, anon;
grant execute on function private.set_tv_tables(uuid, uuid[]) to authenticated;
revoke all on function public.set_tv_tables(uuid, uuid[]) from public, anon;
grant execute on function public.set_tv_tables(uuid, uuid[]) to authenticated;

-- The call time board shows the TV's own tables, every table where it has none.
create or replace function private.tv_call_time_board()
returns table (table_id uuid, table_name text, stake_name text, seat integer, display_name text, call_time_left integer, is_away boolean,
               leaving_at timestamptz, game text, small_blind_paise bigint, big_blind_paise bigint, straddle_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, ty.name, s.seat,
         case when coalesce(p.name_on_tvs, true) then private.first_name_and_initial(m.full_name) end,
         private.session_call_time(s, now()), s.away_since is not null, s.leaving_at, ty.game, ty.small_blind_paise, ty.big_blind_paise, ty.straddle_paise
  from public.seat_session s
  join public.game_table g on g.id = s.table_id
  join public.table_type ty on ty.id = g.table_type_id
  join public.member m on m.id = s.member_id
  left join public.member_preference p on p.member_id = s.member_id
  left join public.tv_screen tv on tv.device_id = (select private.current_device_id())
  where s.venue_id = private.tv_showing('call_time') and s.ended_at is null
    and (s.leaving_at is not null or private.session_call_time(s, now()) > 0)
    and (coalesce(cardinality(tv.tables), 0) = 0 or g.id = any (tv.tables))
  order by g.position, s.seat;
$$;

-- Window-only pairing goes: codes are given whenever a TV asks, within the limits on how often.
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

drop function public.tv_pairing_policy(uuid);
drop function private.tv_pairing_policy(uuid);
drop function public.open_tv_pairing_window(uuid);
drop function private.open_tv_pairing_window(uuid);
drop function public.set_tv_pairing_window_only(uuid, boolean);
drop function private.set_tv_pairing_window_only(uuid, boolean);

-- The super admins' configuration lists its columns, so it is made again without the window's.
drop view public.venue_config_detail;
alter table public.venue_config drop column tv_pairing_window_only, drop column tv_pairing_window_at;
create view public.venue_config_detail with (security_invoker = true) as
select venue_id, legal_name, gstin, address, upi_payee_name, upi_vpa, bank_name, bank_account_name, bank_account_number, bank_ifsc,
       invoice_prefix, logo_path, alert_whatsapp, created_at, updated_at, tan, sac_club_services, signatory_name, signatory_designation,
       contact_phone, contact_whatsapp, alert_email_on, alert_emails
from private.venue_config_detail_rows();
revoke all on public.venue_config_detail from public, anon, authenticated, service_role;
grant select on public.venue_config_detail to authenticated;
