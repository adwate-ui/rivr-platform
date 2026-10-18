-- KYC in person at the club (#246, the owner's answer to #235). While no KYC vendor is live, a KYC
-- reviewer checks a member's original documents with the member there: takes their photo, and enters
-- the date of birth, the last four Aadhaar digits and the PAN. The member gives consent to the check
-- in person, recorded with the staff member's name. The same gate decides: 18 or over, and no PAN or
-- Aadhaar a verified member holds (private.settle_kyc). With no vendor there is no Aadhaar reference,
-- so the last four digits and date of birth stand in for it, and no face search, so a duplicate face
-- cannot be found; the PAN is re-checked once a vendor is live (#237).
-- The kyc-in-person Edge Function stores the photo and calls these, as the reviewer.

alter table public.kyc_record drop constraint kyc_record_method_check;
alter table public.kyc_record add constraint kyc_record_method_check check (method in ('digilocker', 'pan', 'manual'));

-- The KYC photo: the member's selfie, or for a check in person the photo the reviewer took, at a path
-- of that check's own; both built from the member's own ids.
alter table public.kyc_record drop constraint kyc_record_photo_is_the_selfie;
alter table public.kyc_record add constraint kyc_record_photo_is_the_selfie check (
  photo_path = venue_id::text || '/' || member_id::text || '/selfie.jpg'
  or (method = 'manual' and photo_path ~ ('^' || venue_id::text || '/' || member_id::text || '/in-person-[0-9a-f-]{36}\.jpg$'))
);

-- A check in person is a reviewer's approval too, recorded the same way: method 'manual', where a
-- review of a vendor's check is 'vendor'.
alter table public.kyc_review add column method text not null default 'vendor' check (method in ('vendor', 'manual'));

-- The method is the check's own, whichever way the decision is made: a check in person later approved
-- from the queue stays manual.
create function private.kyc_review_method()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.method := case when (select k.method from public.kyc_record k where k.member_id = new.member_id) = 'manual'
                     then 'manual' else 'vendor' end;
  return new;
end;
$$;

create trigger kyc_review_method before insert on public.kyc_review
  for each row execute function private.kyc_review_method();

-- A check in person that clashes with another check goes to review, and its row says so.
alter table public.kyc_review drop constraint kyc_review_outcome_check;
alter table public.kyc_review add constraint kyc_review_outcome_check check (outcome in ('verified', 'refused', 'needs_review'));

-- The audit log keeps the method with the decision; still never the reason.
create or replace function private.audit_kyc_review_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.kyc_review := coalesce(new, old);
  safe text[] := array['id', 'member_id', 'decision', 'method', 'entered_date_of_birth', 'entered_pan', 'outcome', 'reviewed_by_staff_id'];
begin
  perform private.audit(
    changed.venue_id, lower(tg_op), 'kyc_review', changed.id::text,
    case when tg_op <> 'INSERT' then (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(old)) as e (k, v) where k = any (safe)) end,
    case when tg_op <> 'DELETE' then (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(new)) as e (k, v) where k = any (safe)) end
  );
  return null;
end;
$$;

-- The gate, with one more refusal. A check in person has no Aadhaar reference, so the same last four
-- Aadhaar digits and date of birth as a verified member, one of the two checked in person, is taken as
-- the same Aadhaar (the safest reading, question #255). A face cannot be compared without a vendor.
create or replace function private.kyc_refusal(p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when k.date_of_birth > (now() at time zone v.time_zone)::date - make_interval(years => private.kyc_minimum_age(k.venue_id))
      then 'under_18'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified' and o.pan = k.pan)
      then 'duplicate_pan'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified'
                   and o.aadhaar_reference = k.aadhaar_reference)
      then 'duplicate_aadhaar'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified'
                   and 'manual' in (o.method, k.method)
                   and o.masked_aadhaar = k.masked_aadhaar and o.date_of_birth = k.date_of_birth)
      then 'duplicate_aadhaar'
    when exists (select 1 from public.kyc_record o
                 where o.venue_id = k.venue_id and o.member_id <> k.member_id and o.status = 'verified'
                   and (o.member_id = k.same_face_as or o.same_face_as = k.member_id))
      then 'duplicate_face'
  end
  from public.kyc_record k join public.venue v on v.id = k.venue_id
  where k.member_id = p_member_id;
$$;

-- A consent the member gave in person at the club, and who recorded it.
alter table public.consent add column recorded_by_staff_id uuid references public.staff (id);
create index consent_recorded_by_staff_id_idx on public.consent (recorded_by_staff_id);

-- Whether the signed-in person may check this member in person: a KYC reviewer at the member's venue,
-- never for their own check nor for a member they added or changed (who could be anyone they made
-- up), while KYC sign-up is not stopped, and only a member with no check yet or one the app started
-- and never finished. Raises 42501, RVKIL (or RVFRZ, RVMBR) or RVKYC.
create function private.assert_may_check_in_person(p_member_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id);
  v_status text := (select k.status from public.kyc_record k where k.member_id = p_member_id);
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'kyc.review') or private.is_own_kyc_check(p_member_id)
     or private.changed_member(p_member_id) then
    raise exception 'Only a KYC reviewer checks a member in person, never themselves or a member they added or changed'
      using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, 'kyc_signup'::public.killable_feature, p_member_id);
  if v_status is not null and v_status <> 'started' then
    raise exception 'This member''s check is decided, waits for review, or waits for their PAN' using errcode = 'RVKYC';
  end if;
end;
$$;

-- Whether the signed-in person added or changed this member's record, as the audit log says.
create function private.changed_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.audit_log a
                 where a.entity = 'member' and a.entity_id = p_member_id::text and a.actor_user_id = (select auth.uid()));
$$;

-- Where this check's photo goes, once the reviewer may make it; the Edge Function asks before it
-- stores any photo. Each check has a path of its own, so it never replaces the member's selfie or
-- another check's photo, and a failed check removes only its own.
create function private.authorize_in_person_kyc(p_member_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.assert_may_check_in_person(p_member_id);
  return (select m.venue_id from public.member m where m.id = p_member_id)::text || '/' || p_member_id::text
         || '/in-person-' || gen_random_uuid()::text || '.jpg';
end;
$$;

-- The check in person, once its photo is stored: the details become the member's check, the consent
-- is recorded, and the gate settles it. What the app's selfie found (a face like another member's) is
-- kept for the gate, and a clash with another check sends it to review. Returns verified, refused or
-- needs_review.
create function private.check_kyc_in_person(
  p_member_id uuid, p_photo_path text, p_date_of_birth date, p_aadhaar_last4 text, p_pan text, p_consent boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
  v_staff_id uuid;
  v_status text;
begin
  -- One check of a member at a time: a second waits here, then finds the first decided.
  select m.venue_id into v_venue_id from public.member m where m.id = p_member_id for no key update;
  perform private.assert_may_check_in_person(p_member_id);
  v_staff_id := private.current_staff_id(v_venue_id);
  if p_consent is not true or p_date_of_birth is null or p_date_of_birth not between '1900-01-01' and current_date
     or coalesce(p_aadhaar_last4, '') !~ '^[0-9]{4}$'
     or upper(trim(coalesce(p_pan, ''))) !~ '^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$' then
    raise exception 'A check in person needs consent, the date of birth, the last four Aadhaar digits and the PAN'
      using errcode = '22023';
  end if;
  -- This check's own photo, stored in the last ten minutes.
  if coalesce(p_photo_path, '') !~ ('^' || v_venue_id::text || '/' || p_member_id::text || '/in-person-[0-9a-f-]{36}\.jpg$')
     or not exists (select 1 from storage.objects o
                    where o.bucket_id = 'kyc' and o.name = p_photo_path and o.created_at > now() - interval '10 minutes') then
    raise exception 'Take the member''s photo first' using errcode = 'RVPHT';
  end if;
  insert into public.kyc_record (venue_id, member_id, status, method, photo_path, date_of_birth, masked_aadhaar, pan)
  values (v_venue_id, p_member_id, 'started', 'manual', p_photo_path, p_date_of_birth, 'XXXX XXXX ' || p_aadhaar_last4,
          upper(trim(p_pan)))
  on conflict (member_id) do update
  set method = 'manual', photo_path = excluded.photo_path, date_of_birth = excluded.date_of_birth,
      masked_aadhaar = excluded.masked_aadhaar, pan = excluded.pan, refusal = null, verified_at = null
  where public.kyc_record.status = 'started';
  if not found then
    raise exception 'This member''s check is decided, waits for review, or waits for their PAN' using errcode = 'RVKYC';
  end if;
  insert into public.consent (venue_id, member_id, purpose, recorded_by_staff_id)
  values (v_venue_id, p_member_id, 'kyc_verification', v_staff_id)
  on conflict (member_id, purpose) where withdrawn_at is null do nothing;
  v_status := private.settle_kyc(p_member_id, 'verified', false);
  insert into public.kyc_review (venue_id, member_id, decision, reason, entered_date_of_birth, entered_pan, outcome, reviewed_by_staff_id, method)
  values (v_venue_id, p_member_id, 'approved', 'Checked in person against the original documents at the club', true, true,
          v_status, v_staff_id, 'manual');
  return v_status;
end;
$$;

-- The members a KYC reviewer may check in person, found by name or by the last digits of their
-- mobile number: no check yet, or one the app started and never finished; never the reviewer's own
-- or one they added or changed. Twenty at most, and only the last four digits of the number.
create function private.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, right(m.phone, 4), k.status
  from public.member m left join public.kyc_record k on k.member_id = m.id
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'kyc.review')
    and (k.id is null or k.status = 'started')
    -- Null for a reviewer with no member record of their own, which is not their own check.
    and private.is_own_kyc_check(m.id) is not true
    and not private.changed_member(m.id)
    and length(trim(p_search)) between 2 and 100
    -- position, not like: a search is text, never a pattern.
    and (position(lower(trim(p_search)) in lower(m.full_name)) > 0
         or (trim(p_search) ~ '^[0-9]{4,10}$' and right(m.phone, length(trim(p_search))) = trim(p_search)))
  order by m.full_name
  limit 20;
$$;

grant execute on function private.assert_may_check_in_person(uuid), private.changed_member(uuid),
  private.authorize_in_person_kyc(uuid), private.check_kyc_in_person(uuid, text, date, text, text, boolean),
  private.kyc_in_person_candidates(uuid, text) to authenticated;

-- Signed-in callers reach them only through these invoker wrappers.
create function public.authorize_in_person_kyc(p_member_id uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.authorize_in_person_kyc(p_member_id);
$$;

create function public.check_kyc_in_person(
  p_member_id uuid, p_photo_path text, p_date_of_birth date, p_aadhaar_last4 text, p_pan text, p_consent boolean
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.check_kyc_in_person(p_member_id, p_photo_path, p_date_of_birth, p_aadhaar_last4, p_pan, p_consent);
$$;

create function public.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.kyc_in_person_candidates(p_venue_id, p_search);
$$;

grant execute on function public.authorize_in_person_kyc(uuid), public.check_kyc_in_person(uuid, text, date, text, text, boolean),
  public.kyc_in_person_candidates(uuid, text) to authenticated;
