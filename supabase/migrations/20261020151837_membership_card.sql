-- The digital membership card (#71; tech plan item 28; decision 0162). The player app shows the member's
-- card with a QR that changes every card.qr_rotation_seconds (30 unless set); the door's scanner types
-- the code and the front desk checks the member in. A code is the card, when its time window began, and a
-- MAC of both under a key kept in Vault, so neither the phone nor a backup ever holds it. A code from an
-- earlier window, such as a screenshot, does not check in (RVCRD) once five seconds have passed since it
-- changed, so a code scanned as it changes still works. The card is core: never gated by tier.

insert into public.setting_key (key, description, scope, value_schema) values
  ('card.qr_rotation_seconds',
   'How often the membership card''s QR changes, in seconds; a code from before a change no longer checks in (#71). 30 unless set.',
   'venue',
   '{"type":"object","properties":{"seconds":{"type":"integer","minimum":10,"maximum":300}},"required":["seconds"],"additionalProperties":false}');

create table public.membership_card (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.membership_card is 'A member''s digital card, whose rotating QR codes check them in at the door (#71).';

create index membership_card_member_venue_idx on public.membership_card (member_id, venue_id);
create trigger membership_card_touch_updated_at before update on public.membership_card
  for each row execute function private.touch_updated_at();
-- No policy: nobody reads or writes a card but the functions below.
alter table public.membership_card enable row level security;

-- The key every card's codes are signed with, in Vault: encrypted with a key outside the database, so a
-- dump or a backup holds no way to make a code. Only private.card_code reads it.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'membership_card_key',
                           'HMAC key for the membership card''s door codes (#71)');

-- How long a venue's code windows are at a moment, and when the window that moment falls in began, in
-- epoch seconds. A code names its window by its start, so changing the setting leaves earlier codes readable.
create function private.card_window(p_venue_id uuid, p_at timestamptz)
returns table (o_start bigint, o_seconds integer)
language sql
stable
security definer
set search_path = ''
as $$
  select (floor(extract(epoch from p_at) / s.seconds) * s.seconds)::bigint, s.seconds
  from (select coalesce((private.setting_at(p_venue_id, 'card.qr_rotation_seconds', '', p_at) ->> 'seconds')::integer, 30) as seconds) s;
$$;

-- A card's code for the window starting at `p_start`: the card, the start and their MAC.
create function private.card_code(p_card_id uuid, p_start bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'membership_card_key');
  v_signed text := p_card_id::text || '.' || p_start::text;
begin
  if v_key is null then
    raise exception 'The membership card key is missing from Vault';
  end if;
  return v_signed || '.' || left(encode(extensions.hmac(convert_to(v_signed, 'UTF8'), decode(v_key, 'hex'), 'sha256'), 'hex'), 24);
end;
$$;

-- The signed-in member's card, made the first time it is asked for, with the code for now and how many
-- milliseconds it has left by the database's clock; nothing for someone who is not a member.
create function private.my_membership_card()
returns table (member_number bigint, full_name text, tier_name text, code text, ms_left integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_card_id uuid;
  v_window record;
begin
  select * into v_member from public.member m where m.id = private.current_member_id();
  if v_member.id is null then return; end if;
  insert into public.membership_card (venue_id, member_id) values (v_member.venue_id, v_member.id) on conflict (member_id) do nothing;
  select c.id into v_card_id from public.membership_card c where c.member_id = v_member.id;
  select * into v_window from private.card_window(v_member.venue_id, now());
  return query
  select v_member.member_number, v_member.full_name, t.name, private.card_code(v_card_id, v_window.o_start),
         ceil((v_window.o_start + v_window.o_seconds - extract(epoch from now())) * 1000)::integer
  from public.tier t where t.id = v_member.tier_id;
end;
$$;

-- The member whose card made a code, if the code is the venue's and current at `p_at`: its window has
-- begun and ended no more than five seconds ago. Anything else is refused (RVCRD).
create function private.card_member(p_venue_id uuid, p_code text, p_at timestamptz)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(coalesce(p_code, ''), '.');
  v_card public.membership_card;
  v_start bigint;
  v_seconds integer;
begin
  if coalesce(array_length(v_parts, 1), 0) <> 3 or v_parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_parts[2] !~ '^[0-9]{1,12}$' then
    raise exception 'Not a membership card code' using errcode = 'RVCRD';
  end if;
  v_start := v_parts[2]::bigint;
  select * into v_card from public.membership_card c where c.id = v_parts[1]::uuid and c.venue_id = p_venue_id;
  select w.o_seconds into v_seconds from private.card_window(p_venue_id, to_timestamp(v_start)) w;
  if v_card.id is null or private.card_code(v_card.id, v_start) <> p_code
     or not (to_timestamp(v_start) <= p_at and p_at < to_timestamp(v_start + v_seconds) + interval '5 seconds') then
    raise exception 'That card code is not current' using errcode = 'RVCRD';
  end if;
  return v_card.member_id;
end;
$$;

-- The door's scanner reads a member's card: the front desk checks them in.
create function private.check_in_by_card(p_venue_id uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the front desk checks a member in' using errcode = '42501';
  end if;
  return private.check_in(p_venue_id, private.card_member(p_venue_id, p_code, now()));
end;
$$;

revoke execute on function private.card_window(uuid, timestamptz), private.card_code(uuid, bigint), private.card_member(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function private.my_membership_card(), private.check_in_by_card(uuid, text) from public, anon;
grant execute on function private.my_membership_card(), private.check_in_by_card(uuid, text) to authenticated;

create function public.my_membership_card()
returns table (member_number bigint, full_name text, tier_name text, code text, ms_left integer)
language sql volatile security invoker set search_path = ''
as $$ select * from private.my_membership_card(); $$;

create function public.check_in_by_card(p_venue_id uuid, p_code text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.check_in_by_card(p_venue_id, p_code); $$;

revoke execute on function public.my_membership_card(), public.check_in_by_card(uuid, text) from public, anon;
grant execute on function public.my_membership_card(), public.check_in_by_card(uuid, text) to authenticated;
