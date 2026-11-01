-- The caller's address (audit of 28 Oct, A4-17; decision 0287). Behind hosted Supabase, Cloudflare sets cf-connecting-ip,
-- which a client cannot forge. Without it (the local stack) the address is the last X-Forwarded-For hop, the one the
-- gateway added, not the first, which is whatever the client sent. No address gives null, which the staff-network checks
-- refuse, saving the networks included.

-- As 20261018090000_venues.sql made it, with the last X-Forwarded-For hop.
-- The caller's IP address, for the audit log and the staff-network checks. Null outside an API request. Hosted Supabase
-- sits behind Cloudflare, which overwrites cf-connecting-ip with the real client address, so a client cannot forge it.
-- Without it, the last X-Forwarded-For hop is the one the gateway added; the earlier ones are whatever the client sent.
create or replace function private.request_ip()
returns inet
language plpgsql
stable
set search_path = ''
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  forwarded text[] := string_to_array(coalesce(headers ->> 'x-forwarded-for', ''), ',');
  address text := coalesce(headers ->> 'cf-connecting-ip', forwarded[cardinality(forwarded)]);
begin
  return nullif(trim(address), '')::inet;
exception when invalid_text_representation then
  return null;
end;
$$;

-- As 20261020170000_cage_computers.sql made it, with no address counted as off the venue's networks.
create or replace function private.guard_staff_networks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.staff_ip_allowlist is distinct from old.staff_ip_allowlist and cardinality(new.staff_ip_allowlist) > 0
     and (select auth.uid()) is not null
     and not exists (select 1 from public.venue v where v.id = new.venue_id and v.is_practice)
     and not (coalesce(private.request_ip() <<= any (new.staff_ip_allowlist), false)
              and (private.request_computer(new.venue_id)).kind is not distinct from 'console') then
    raise exception 'Save the networks from an enrolled admin console on one of them' using errcode = 'RVNET';
  end if;
  return new;
end;
$$;

