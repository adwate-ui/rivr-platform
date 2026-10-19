-- Dealer sign-in and downs (#41, scope-v1 module 4; design prompt: "Sign in: dealer PIN pad, table
-- fixed as Table 3"; "Dealer signs in by PIN on push; on/off times stamp automatically"). Staff with
-- staff.manage set a dealer's four-digit PIN on the console, kept as a bcrypt hash in
-- staff_credential. On a paired tablet fixed to a table, the dealer picks their name and enters the
-- PIN: the down starts, and the down before it at that table, or the dealer's own elsewhere, ends.
-- Five wrong PINs lock that dealer's PIN for 15 minutes. End of down stamps the off time.

alter table public.staff_credential
  add column failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  add column locked_until timestamptz;
alter table public.staff add constraint staff_id_venue_id_key unique (id, venue_id);

-- A dealer's shift at one table: on and off times. The drop-box count and variance are #44's.
create table public.dealer_down (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  table_id uuid not null,
  staff_id uuid not null,
  device_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (table_id, venue_id) references public.game_table (id, venue_id),
  foreign key (staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (device_id, venue_id) references public.device (id, venue_id),
  check (ended_at is null or ended_at >= started_at)
);

comment on table public.dealer_down is 'A dealer''s down at one table, from PIN sign-in to its end (#41).';

-- One open down per table and one per dealer.
create unique index dealer_down_open_table_idx on public.dealer_down (table_id) where ended_at is null;
create unique index dealer_down_open_staff_idx on public.dealer_down (staff_id) where ended_at is null;
create index dealer_down_table_venue_idx on public.dealer_down (table_id, venue_id);
create index dealer_down_staff_venue_idx on public.dealer_down (staff_id, venue_id);
create index dealer_down_device_venue_idx on public.dealer_down (device_id, venue_id);
create index dealer_down_venue_started_idx on public.dealer_down (venue_id, started_at);
create trigger dealer_down_touch_updated_at before update on public.dealer_down
  for each row execute function private.touch_updated_at();
create trigger dealer_down_audit after insert or update or delete on public.dealer_down
  for each row execute function private.audit_row_change();
alter table public.dealer_down enable row level security;
grant select on public.dealer_down to authenticated;

create policy "staff and the venue's tablets see downs" on public.dealer_down
  for select to authenticated
  using (venue_id in (select private.staff_venues())
         or venue_id = (select d.venue_id from public.device d where d.id = (select private.current_device_id())));

-- Active staff at the venue whose role logs hands, and whose access is not revoked.
create function private.is_dealer_at(p_staff_id uuid, p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s join public.role_permission rp on rp.role = s.role and rp.permission = 'hands.log'
    where s.id = p_staff_id and s.venue_id = p_venue_id and s.is_active
      and not exists (select 1 from public.control_state c
                      where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null));
$$;

-- Staff with staff.manage set a dealer's four-digit PIN, for a role they may grant (see
-- venue_dealers). A new PIN unlocks a locked one.
create function private.set_dealer_pin(p_staff_id uuid, p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_staff public.staff;
begin
  select * into v_staff from public.staff s where s.id = p_staff_id;
  if v_staff.id is null or not private.has_permission(v_staff.venue_id, 'staff.manage')
     or not private.can_grant_role(v_staff.venue_id, v_staff.role) or not private.is_dealer_at(v_staff.id, v_staff.venue_id) then
    raise exception 'Only staff managers set a dealer''s PIN' using errcode = '42501';
  end if;
  -- Four digits, and not one digit four times.
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' or p_pin ~ '^(.)\1{3}$' then
    raise exception 'A PIN is four digits, not all the same' using errcode = '22023';
  end if;
  insert into public.staff_credential (staff_id, venue_id, pin_hash)
  values (v_staff.id, v_staff.venue_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (staff_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
end;
$$;

-- The venue's dealers whose PIN the caller may set: whether each has a PIN, and until when it is
-- locked. A dealer logs hands, so only staff who hold every permission of the dealer's role (in
-- practice the owner and the general manager, not an admin) set one: else setting a PIN would let
-- them log hands as the dealer.
create function private.venue_dealers(p_venue_id uuid)
returns table (staff_id uuid, full_name text, has_pin boolean, locked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, c.staff_id is not null, case when c.locked_until > now() then c.locked_until end
  from public.staff s
  left join public.staff_credential c on c.staff_id = s.id
  where s.venue_id = p_venue_id and private.is_dealer_at(s.id, p_venue_id)
    and private.has_permission(p_venue_id, 'staff.manage') and private.can_grant_role(p_venue_id, s.role)
  order by s.full_name;
$$;

-- The tablet's venue, and the table it is fixed to; refused for anyone but a paired dealer tablet.
create function private.my_tablet_table(out o_device_id uuid, out o_venue_id uuid, out o_table_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  select d.id, d.venue_id, a.table_id into o_device_id, o_venue_id, o_table_id
  from public.device d left join public.tablet_assignment a on a.device_id = d.id
  where d.id = private.current_device_id() and d.kind = 'dealer_tablet';
  if o_device_id is null then
    raise exception 'Only a paired dealer tablet does this' using errcode = '42501';
  end if;
  if o_table_id is null then
    raise exception 'This tablet is not fixed to a table' using errcode = '22023';
  end if;
end;
$$;

-- The dealers who can sign in on this tablet: those at its venue with a PIN.
create function private.tablet_dealers()
returns table (staff_id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name
  from public.staff s join public.staff_credential c on c.staff_id = s.id
  where s.venue_id = (select o_venue_id from private.my_tablet_table()) and private.is_dealer_at(s.id, s.venue_id)
  order by s.full_name;
$$;

-- A dealer signs in on the tablet with their PIN, and their down starts at its table. A wrong PIN
-- is counted, not raised, so the count is kept: `refusal` is wrong_pin (with the tries left) or
-- locked. Not while the venue is frozen.
create function private.dealer_sign_in(p_staff_id uuid, p_pin text)
returns table (down_id uuid, refusal text, tries_left integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tablet record;
  v_credential public.staff_credential;
  v_down_id uuid;
begin
  select * into v_tablet from private.my_tablet_table();
  perform private.assert_writable(v_tablet.o_venue_id);
  select * into v_credential from public.staff_credential c
  where c.staff_id = p_staff_id and c.venue_id = v_tablet.o_venue_id and private.is_dealer_at(c.staff_id, c.venue_id)
  for update;
  if v_credential.staff_id is null then
    -- No PIN (or not a dealer here): the same answer, after the same bcrypt work, as a first wrong
    -- PIN, so the tablet cannot be used to find out who has one.
    perform extensions.crypt(coalesce(p_pin, ''), extensions.gen_salt('bf', 8));
    return query select null::uuid, 'wrong_pin', 4;
    return;
  end if;
  if v_credential.locked_until > now() then
    return query select null::uuid, 'locked', 0;
    return;
  end if;
  if extensions.crypt(coalesce(p_pin, ''), v_credential.pin_hash) <> v_credential.pin_hash then
    update public.staff_credential c
    set failed_attempts = case when c.failed_attempts >= 4 then 0 else c.failed_attempts + 1 end,
        locked_until = case when c.failed_attempts >= 4 then now() + interval '15 minutes' end
    where c.staff_id = v_credential.staff_id;
    return query select null::uuid, case when v_credential.failed_attempts >= 4 then 'locked' else 'wrong_pin' end,
                        4 - least(v_credential.failed_attempts, 4);
    return;
  end if;
  update public.staff_credential c set failed_attempts = 0, locked_until = null where c.staff_id = v_credential.staff_id;
  update public.dealer_down dd set ended_at = now()
  where dd.ended_at is null and (dd.table_id = v_tablet.o_table_id or dd.staff_id = v_credential.staff_id);
  insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
  values (v_tablet.o_venue_id, v_tablet.o_table_id, v_credential.staff_id, v_tablet.o_device_id)
  returning id into v_down_id;
  return query select v_down_id, null::text, null::integer;
end;
$$;

-- End of down on the tablet: the off time is stamped, and the tablet asks for the next dealer. Also
-- while the venue is frozen: it closes a record and moves no money, seat or hand (decision 0046).
create function private.end_down()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tablet record;
begin
  select * into v_tablet from private.my_tablet_table();
  update public.dealer_down dd set ended_at = now() where dd.table_id = v_tablet.o_table_id and dd.ended_at is null;
end;
$$;

-- The open down at the tablet's table: who is dealing, since when. Nothing between downs.
create function private.current_down()
returns table (down_id uuid, staff_id uuid, full_name text, started_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select dd.id, s.id, s.full_name, dd.started_at
  from public.dealer_down dd join public.staff s on s.id = dd.staff_id
  where dd.table_id = (select o_table_id from private.my_tablet_table()) and dd.ended_at is null;
$$;

revoke execute on function private.is_dealer_at(uuid, uuid), private.my_tablet_table() from public, anon, authenticated;
grant execute on function private.set_dealer_pin(uuid, text), private.venue_dealers(uuid), private.tablet_dealers(),
  private.dealer_sign_in(uuid, text), private.end_down(), private.current_down() to authenticated;

create function public.set_dealer_pin(p_staff_id uuid, p_pin text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_dealer_pin(p_staff_id, p_pin); $$;

create function public.venue_dealers(p_venue_id uuid)
returns table (staff_id uuid, full_name text, has_pin boolean, locked_until timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_dealers(p_venue_id); $$;

create function public.tablet_dealers()
returns table (staff_id uuid, full_name text)
language sql stable security invoker set search_path = ''
as $$ select * from private.tablet_dealers(); $$;

create function public.dealer_sign_in(p_staff_id uuid, p_pin text)
returns table (down_id uuid, refusal text, tries_left integer)
language sql volatile security invoker set search_path = ''
as $$ select * from private.dealer_sign_in(p_staff_id, p_pin); $$;

create function public.end_down()
returns void language sql volatile security invoker set search_path = ''
as $$ select private.end_down(); $$;

create function public.current_down()
returns table (down_id uuid, staff_id uuid, full_name text, started_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.current_down(); $$;

revoke execute on function public.set_dealer_pin(uuid, text), public.venue_dealers(uuid), public.tablet_dealers(),
  public.dealer_sign_in(uuid, text), public.end_down(), public.current_down() from public, anon;
grant execute on function public.set_dealer_pin(uuid, text), public.venue_dealers(uuid), public.tablet_dealers(),
  public.dealer_sign_in(uuid, text), public.end_down(), public.current_down() to authenticated;
