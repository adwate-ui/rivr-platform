-- DigiLocker on Zoop (#1023; decision 0676). Zoop sends the member's documents to a webhook (the kyc-digilocker function)
-- rather than when asked, and the member can be back in the app before they arrive. What the webhook reads waits here until
-- the kyc function's complete step takes it: the fields record_kyc_digilocker keeps and the Aadhaar photo for the face
-- match, never the documents themselves. A row is one member's DigiLocker session: its id and the hash of the key Zoop puts
-- on its delivery, set when the hand-off starts. It goes as soon as the check leaves the session (recorded either way, a new
-- hand-off, reopened, erased), and an hourly job removes any left after two hours.

create table private.kyc_digilocker_delivery (
  member_id uuid primary key references public.member (id) on delete cascade,
  venue_id uuid not null references public.venue (id) on delete cascade,
  session_id text not null unique,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null default now(),
  -- When the complete step last asked Zoop where the session stands: at most every 30 seconds.
  status_asked_at timestamptz,
  delivered_at timestamptz,
  outcome text check (outcome in ('fetched', 'refused')),
  name text check (length(name) <= 200),
  date_of_birth date,
  masked_aadhaar text check (masked_aadhaar ~ '^XXXX XXXX [0-9]{4}$'),
  pan text check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  address text check (length(address) <= 500),
  -- The Aadhaar photo as DigiLocker sent it, a JPEG as the `data:` URL the face match takes.
  photo text check (length(photo) <= 300100 and photo like 'data:image/jpeg;base64,/9j/%'),
  vendor_reference text check (length(vendor_reference) <= 100),
  refusal text check (length(refusal) <= 80),
  check ((outcome is null) = (delivered_at is null)),
  check (outcome is distinct from 'fetched' or (name is not null and masked_aadhaar is not null and photo is not null and vendor_reference is not null)),
  check (outcome is distinct from 'refused' or refusal is not null)
);
alter table private.kyc_digilocker_delivery enable row level security;
revoke all on private.kyc_digilocker_delivery from public, anon, authenticated;

-- As 20261018091500_kyc_selfie_and_gate.sql made it, and the session a webhook will deliver for, by its key's hash. A vendor
-- that hands the record over when asked (the fake) gives no key and holds nothing. A new hand-off drops the last one's.
drop function public.record_kyc_started(uuid, text);
create function public.record_kyc_started(p_member_id uuid, p_session_id text, p_delivery_key text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  perform private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set status = 'started', method = 'digilocker', digilocker_session_id = p_session_id
  where member_id = p_member_id and status in ('started', 'needs_pan') and photo_path is not null
  returning venue_id into v_venue_id;
  if v_venue_id is null then
    return;
  end if;
  delete from private.kyc_digilocker_delivery d where d.member_id = p_member_id;
  if p_delivery_key is not null then
    insert into private.kyc_digilocker_delivery (member_id, venue_id, session_id, key_hash)
    values (p_member_id, v_venue_id, p_session_id, encode(extensions.digest(p_delivery_key, 'sha256'), 'hex'));
  end if;
end;
$$;
revoke execute on function public.record_kyc_started(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_kyc_started(uuid, text, text) to service_role;

-- The session whose delivery is due under this key, locked, while its check still waits on it and the venue may still take
-- checks: KYC sign-up not stopped, nothing frozen (assert_writable, as every KYC write). One that may not is dropped.
create function private.kyc_digilocker_due(p_key text)
returns private.kyc_digilocker_delivery
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due private.kyc_digilocker_delivery;
begin
  select d.* into v_due
  from private.kyc_digilocker_delivery d
  join public.kyc_record k on k.member_id = d.member_id and k.status = 'started' and k.digilocker_session_id = d.session_id
  where d.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex') and d.delivered_at is null
  for update of d;
  if v_due.member_id is null then
    return null;
  end if;
  begin
    perform private.assert_writable(v_due.venue_id, 'kyc_signup', v_due.member_id);
  exception when sqlstate 'RVKIL' or sqlstate 'RVFRZ' or sqlstate 'RVMBR' then
    delete from private.kyc_digilocker_delivery d where d.member_id = v_due.member_id;
    return null;
  end;
  return v_due;
end;
$$;

-- The session the webhook's key is for: the webhook asks with the header alone, before it reads the body.
create function private.kyc_digilocker_session(p_key text)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select (private.kyc_digilocker_due(p_key)).session_id;
$$;

-- What the webhook read, kept against its session: only under the key given at the start, only once, only while the
-- member's check still waits on that session. 'kept', or 'unknown' for anything else, so the webhook tells no more.
create function private.keep_kyc_digilocker_delivery(
  p_session_id text, p_key text, p_outcome text, p_name text, p_date_of_birth date, p_masked_aadhaar text, p_pan text,
  p_address text, p_photo text, p_vendor_reference text, p_refusal text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due private.kyc_digilocker_delivery := private.kyc_digilocker_due(p_key);
begin
  if v_due.session_id is distinct from p_session_id then
    return 'unknown';
  end if;
  update private.kyc_digilocker_delivery d
  set delivered_at = now(), outcome = p_outcome, name = left(p_name, 200), date_of_birth = p_date_of_birth,
      masked_aadhaar = p_masked_aadhaar, pan = p_pan, address = left(p_address, 500), photo = p_photo,
      vendor_reference = left(p_vendor_reference, 100), refusal = left(p_refusal, 80)
  where d.member_id = v_due.member_id;
  return 'kept';
end;
$$;

-- The member's current session for the complete step: when it started, and what came (outcome null while nothing has).
-- Null when the member has no such session.
create function private.kyc_digilocker_delivery(p_member_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'started_at', d.started_at, 'outcome', d.outcome, 'name', d.name, 'date_of_birth', d.date_of_birth,
    'masked_aadhaar', d.masked_aadhaar, 'pan', d.pan, 'address', d.address, 'photo', d.photo,
    'vendor_reference', d.vendor_reference, 'refusal', d.refusal)
  from private.kyc_digilocker_delivery d
  join public.kyc_record k on k.member_id = d.member_id and k.digilocker_session_id = d.session_id
  where d.member_id = p_member_id;
$$;

-- Whether the complete step may ask Zoop where the member's session stands now: once every 30 seconds at most, however
-- often the app asks, so no member can make RIVR call Zoop without limit.
create function private.may_ask_kyc_digilocker_status(p_member_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with asked as (
    update private.kyc_digilocker_delivery d set status_asked_at = now()
    where d.member_id = p_member_id and (d.status_asked_at is null or d.status_asked_at <= now() - interval '30 seconds')
    returning 1
  )
  select exists (select from asked);
$$;

-- The check left its session: recorded either way, a new hand-off, reopened, erased or deleted. Its delivery goes with it.
create function private.forget_kyc_digilocker_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.kyc_digilocker_delivery d
  where d.member_id = old.member_id
    and (tg_op = 'DELETE' or new.status <> 'started' or new.digilocker_session_id is distinct from d.session_id);
  return null;
end;
$$;
create trigger kyc_record_forget_digilocker_delivery after update of status, digilocker_session_id or delete on public.kyc_record
  for each row execute function private.forget_kyc_digilocker_delivery();

-- Zoop's session lasts thirty minutes: a delivery not taken within two hours never will be. Hourly, so none stays three.
create function private.forget_stale_kyc_digilocker_deliveries()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.kyc_digilocker_delivery d where d.started_at <= now() - interval '2 hours';
$$;
select cron.schedule('kyc-digilocker-deliveries-forget', '35 * * * *', 'select private.forget_stale_kyc_digilocker_deliveries()');

create function public.kyc_digilocker_session(p_key text)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.kyc_digilocker_session(p_key); $$;
create function public.keep_kyc_digilocker_delivery(
  p_session_id text, p_key text, p_outcome text, p_name text, p_date_of_birth date, p_masked_aadhaar text, p_pan text,
  p_address text, p_photo text, p_vendor_reference text, p_refusal text
)
returns text language sql volatile security invoker set search_path = ''
as $$
  select private.keep_kyc_digilocker_delivery(p_session_id, p_key, p_outcome, p_name, p_date_of_birth, p_masked_aadhaar, p_pan,
    p_address, p_photo, p_vendor_reference, p_refusal);
$$;
create function public.kyc_digilocker_delivery(p_member_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.kyc_digilocker_delivery(p_member_id); $$;
create function public.may_ask_kyc_digilocker_status(p_member_id uuid)
returns boolean language sql volatile security invoker set search_path = ''
as $$ select private.may_ask_kyc_digilocker_status(p_member_id); $$;

revoke execute on function
  private.kyc_digilocker_due(text), private.kyc_digilocker_session(text), public.kyc_digilocker_session(text),
  private.keep_kyc_digilocker_delivery(text, text, text, text, date, text, text, text, text, text, text),
  public.keep_kyc_digilocker_delivery(text, text, text, text, date, text, text, text, text, text, text),
  private.kyc_digilocker_delivery(uuid), public.kyc_digilocker_delivery(uuid),
  private.may_ask_kyc_digilocker_status(uuid), public.may_ask_kyc_digilocker_status(uuid),
  private.forget_kyc_digilocker_delivery(), private.forget_stale_kyc_digilocker_deliveries()
  from public, anon, authenticated;
grant execute on function
  private.kyc_digilocker_due(text), private.kyc_digilocker_session(text), public.kyc_digilocker_session(text),
  private.keep_kyc_digilocker_delivery(text, text, text, text, date, text, text, text, text, text, text),
  public.keep_kyc_digilocker_delivery(text, text, text, text, date, text, text, text, text, text, text),
  private.kyc_digilocker_delivery(uuid), public.kyc_digilocker_delivery(uuid),
  private.may_ask_kyc_digilocker_status(uuid), public.may_ask_kyc_digilocker_status(uuid)
  to service_role;
