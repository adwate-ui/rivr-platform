-- KYC records (#4; scope-v1 module 1). What DigiLocker, or a PAN check when DigiLocker fails, says
-- about a member. Only the masked Aadhaar, PAN, date of birth, address and the vendor reference are
-- kept; the documents stay with the vendor, and the member's name is the one on their member record.
-- One record per member: their current check.
create table public.kyc_record (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null unique,
  -- started: sent to DigiLocker. needs_pan: DigiLocker failed or held no PAN. needs_review: a PAN
  -- alone, with no DigiLocker photo, waits for staff. verified: done.
  status text not null default 'started' check (status in ('started', 'needs_pan', 'needs_review', 'verified')),
  method text not null default 'digilocker' check (method in ('digilocker', 'pan')),
  digilocker_session_id text,
  date_of_birth date,
  masked_aadhaar text check (masked_aadhaar ~ '^XXXX XXXX [0-9]{4}$'),
  pan text check (pan ~ '^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$'),
  address text,
  vendor_reference text,
  verified_at timestamptz,
  -- Paid vendor calls in the current 24-hour window (begin_kyc_vendor_call).
  vendor_calls integer not null default 0,
  vendor_calls_since timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  check ((status = 'verified') = (verified_at is not null))
);

comment on table public.kyc_record is 'A member''s identity check: masked Aadhaar, PAN, date of birth, address and the vendor reference only.';

create index kyc_record_venue_id_idx on public.kyc_record (venue_id);
create trigger kyc_record_touch_updated_at before update on public.kyc_record
  for each row execute function private.touch_updated_at();

-- The audit log is append-only and outlives an erasure request, so it records how the check moved,
-- never the identity details themselves.
create function private.audit_kyc_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.kyc_record := coalesce(new, old);
  safe text[] := array['id', 'member_id', 'status', 'method', 'vendor_reference', 'verified_at'];
begin
  perform private.audit(
    changed.venue_id, lower(tg_op), 'kyc_record', changed.id::text,
    case when tg_op <> 'INSERT' then (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(old)) as e (k, v) where k = any (safe)) end,
    case when tg_op <> 'DELETE' then (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(new)) as e (k, v) where k = any (safe)) end
  );
  return null;
end;
$$;

create trigger kyc_record_audit after insert or update or delete on public.kyc_record
  for each row execute function private.audit_kyc_record_change();

alter table public.kyc_record enable row level security;
-- Reads only: the kyc Edge Function writes, through the functions below.
grant select on public.kyc_record to authenticated;

create policy "members see their own KYC record" on public.kyc_record
  for select to authenticated
  using (member_id = (select private.current_member_id()));

create policy "KYC reviewers see the venue's KYC records" on public.kyc_record
  for select to authenticated
  using (venue_id in (select private.venues_where('kyc.review')));

-- The signed-in member the kyc Edge Function acts for: their name as the venue registered it (a PAN
-- is checked against it), and whether their venue is the practice venue, which gets the fake KYC
-- vendor (docs/decisions/0014).
create function private.kyc_subject()
returns table (member_id uuid, venue_id uuid, full_name text, is_practice boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.venue_id, m.full_name, v.is_practice
  from public.member m join public.venue v on v.id = m.venue_id
  where m.id = private.current_member_id();
$$;

-- Called before every vendor call. Refuses while KYC sign-up is stopped (RVKIL) or the member is
-- frozen, without the member's KYC consent (RVCON), and past five paid calls in 24 hours (RVRAT).
create function public.begin_kyc_vendor_call(p_member_id uuid, p_is_paid boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_calls integer;
begin
  perform private.assert_writable(v_venue_id, 'kyc_signup', p_member_id);
  if not private.has_consent(p_member_id, 'kyc_verification') then
    raise exception 'The member has not consented to the identity check' using errcode = 'RVCON';
  end if;
  if not p_is_paid then return; end if;
  insert into public.kyc_record (venue_id, member_id) values (v_venue_id, p_member_id) on conflict (member_id) do nothing;
  update public.kyc_record
  set vendor_calls = case when vendor_calls_since < now() - interval '24 hours' then 1 else vendor_calls + 1 end,
      vendor_calls_since = case when vendor_calls_since < now() - interval '24 hours' then now() else vendor_calls_since end
  where member_id = p_member_id
  returning vendor_calls into v_calls;
  if v_calls > 5 then
    raise exception 'Too many identity checks today' using errcode = 'RVRAT';
  end if;
end;
$$;

-- A DigiLocker hand-off began. A verified record stays verified.
create function public.record_kyc_started(p_member_id uuid, p_session_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set status = 'started', method = 'digilocker', digilocker_session_id = p_session_id
  where member_id = p_member_id and status <> 'verified';
$$;

-- DigiLocker returned the member's record. Without a PAN the check waits for one.
create function public.record_kyc_digilocker(
  p_member_id uuid, p_date_of_birth date, p_masked_aadhaar text, p_pan text, p_address text, p_vendor_reference text
)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set date_of_birth = p_date_of_birth, masked_aadhaar = p_masked_aadhaar, pan = p_pan, address = p_address,
      vendor_reference = p_vendor_reference,
      status = case when p_pan is null then 'needs_pan' else 'verified' end,
      verified_at = case when p_pan is null then null else now() end
  where member_id = p_member_id and status = 'started'
  returning status;
$$;

-- DigiLocker failed: the member checks a PAN instead.
create function public.record_kyc_digilocker_failed(p_member_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record set status = 'needs_pan', method = 'pan'
  where member_id = p_member_id and status = 'started';
$$;

-- A PAN the vendor found valid and matching the member's name. After DigiLocker (which gave the
-- date of birth and the photo) that completes the check; a PAN alone waits for staff to review.
create function public.record_kyc_pan(p_member_id uuid, p_pan text, p_date_of_birth date, p_vendor_reference text)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set pan = p_pan, date_of_birth = coalesce(date_of_birth, p_date_of_birth), vendor_reference = p_vendor_reference,
      status = case when method = 'digilocker' then 'verified' else 'needs_review' end,
      verified_at = case when method = 'digilocker' then now() end
  where member_id = p_member_id and status = 'needs_pan'
  returning status;
$$;

grant execute on function private.kyc_subject() to authenticated;

-- Signed-in callers reach kyc_subject only through this invoker wrapper.
create function public.kyc_subject()
returns table (member_id uuid, venue_id uuid, full_name text, is_practice boolean)
language sql
security invoker
set search_path = ''
as $$
  select * from private.kyc_subject();
$$;

grant execute on function public.kyc_subject() to authenticated;
grant execute on function public.begin_kyc_vendor_call(uuid, boolean), public.record_kyc_started(uuid, text),
  public.record_kyc_digilocker(uuid, date, text, text, text, text), public.record_kyc_digilocker_failed(uuid),
  public.record_kyc_pan(uuid, text, date, text)
  to service_role;
grant select on public.kyc_record to service_role;
