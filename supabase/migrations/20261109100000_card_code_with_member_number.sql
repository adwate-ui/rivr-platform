-- The membership card's QR names the member's number (the owner, 8 Nov): a phone's camera showed a long card id. The
-- code is now `RIVR-<membership number>-<window start>-<MAC>`, as `RIVR-58-1762621800-a3f9c2d1e4b5f6a7b8c9d0e1`. It still
-- changes with each window and is signed over the card and the window with the Vault key, so a screenshot or a number
-- alone checks no one in. As 20261020151837_membership_card.sql made them otherwise.

-- A card's code for the window starting at `p_start`: its member's number, the start, and the MAC of the card and start.
create or replace function private.card_code(p_card_id uuid, p_start bigint)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'membership_card_key');
  v_signed text := p_card_id::text || '.' || p_start::text;
  v_number bigint := (select m.member_number from public.membership_card c join public.member m on m.id = c.member_id where c.id = p_card_id);
begin
  if v_key is null then
    raise exception 'The membership card key is missing from Vault';
  end if;
  return 'RIVR-' || coalesce(v_number::text, '0') || '-' || p_start::text || '-'
         || left(encode(extensions.hmac(convert_to(v_signed, 'UTF8'), decode(v_key, 'hex'), 'sha256'), 'hex'), 24);
end;
$$;

-- The member whose card made a code, if the code is the venue's and current at `p_at`: its window has begun and ended no
-- more than five seconds ago. Anything else is refused (RVCRD).
create or replace function private.card_member(p_venue_id uuid, p_code text, p_at timestamptz)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := regexp_match(coalesce(p_code, ''), '^RIVR-([0-9]{1,12})-([0-9]{1,12})-[0-9a-f]{24}$');
  v_card public.membership_card;
  v_start bigint;
  v_seconds integer;
begin
  if v_parts is null then
    raise exception 'Not a membership card code' using errcode = 'RVCRD';
  end if;
  v_start := v_parts[2]::bigint;
  select c.* into v_card from public.membership_card c join public.member m on m.id = c.member_id
  where m.member_number = v_parts[1]::bigint and c.venue_id = p_venue_id;
  select w.o_seconds into v_seconds from private.card_window(p_venue_id, to_timestamp(v_start)) w;
  if v_card.id is null or private.card_code(v_card.id, v_start) <> p_code
     or not (to_timestamp(v_start) <= p_at and p_at < to_timestamp(v_start + v_seconds) + interval '5 seconds') then
    raise exception 'That card code is not current' using errcode = 'RVCRD';
  end if;
  return v_card.member_id;
end;
$$;
