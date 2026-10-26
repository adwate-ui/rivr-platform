-- KYC on Cashfree Secure ID (#474; decision 0197; the owner's choice of 26 Oct). Cashfree gives no stable
-- reference for an Aadhaar number and has no search of the faces already enrolled, so two checks of one person
-- are now caught another way: the same name, date of birth and last four Aadhaar digits as another member's
-- check holds the new one for a KYC reviewer, who sees the other member's name in the queue. It holds, never
-- refuses: two people can share all three. The PAN, the Aadhaar reference and the face still count where an
-- older check, or the in-person check, kept them.
--
-- The three are taken from DigiLocker's document when the check is made, the name by the same rule as the
-- name match (@rivr/domain kycIdentityKey: letters only, so `Rahul Sharma.` is `rahul sharma`), and kept as a
-- keyed hash, like the Aadhaar reference: a later change of the member's registered name changes nothing.

alter table public.kyc_record add column identity_key text;
comment on column public.kyc_record.identity_key is
  'A keyed hash of the document''s name, date of birth and last four Aadhaar digits, for duplicates (#474).';
create index kyc_record_identity_key_idx on public.kyc_record (venue_id, identity_key) where identity_key is not null;

-- As before (20261018091500_kyc_selfie_and_gate.sql), keeping the identity key with the rest of the person's
-- identity: only when the document's name and face are the member's.
drop function public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, boolean, integer);
create function public.record_kyc_digilocker(
  p_member_id uuid, p_date_of_birth date, p_masked_aadhaar text, p_aadhaar_reference text, p_pan text, p_address text,
  p_vendor_reference text, p_name_matches boolean, p_face_matches boolean, p_face_match_score integer, p_identity_key text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_same_person boolean := coalesce(p_name_matches and p_face_matches, false);
begin
  perform private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set date_of_birth = case when v_same_person then p_date_of_birth end,
      masked_aadhaar = case when v_same_person then p_masked_aadhaar end,
      aadhaar_reference = case when v_same_person then private.kyc_reference(p_aadhaar_reference) end,
      identity_key = case when v_same_person and p_identity_key is not null then private.kyc_reference(p_identity_key) end,
      pan = case when v_same_person then p_pan end,
      address = case when v_same_person then p_address end,
      vendor_reference = p_vendor_reference,
      face_match_score = p_face_match_score
  where member_id = p_member_id and status = 'started' and photo_path is not null;
  if not found then return null; end if;
  return private.settle_kyc(p_member_id, case
    when not v_same_person or p_date_of_birth is null then 'needs_review'
    when p_pan is null then 'needs_pan'
    else 'verified'
  end);
end;
$$;
revoke execute on function public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, boolean, integer, text)
  from public, anon, authenticated;
grant execute on function public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, boolean, integer, text)
  to service_role;

-- Whether two checks at a venue could be of one person: the same PAN, Aadhaar reference, face (either way) or
-- identity key.
create function private.kyc_records_clash(p_check public.kyc_record, p_other public.kyc_record)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_other.venue_id = p_check.venue_id and p_other.member_id <> p_check.member_id
    and (p_other.pan = p_check.pan or p_other.aadhaar_reference = p_check.aadhaar_reference
         or p_other.member_id = p_check.same_face_as or p_other.same_face_as = p_check.member_id
         or p_other.identity_key = p_check.identity_key);
$$;

-- As before (20261018092300_kyc_review.sql), through kyc_records_clash.
create or replace function private.kyc_clashes(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kyc_record k
    join public.kyc_record o on private.kyc_records_clash(k, o)
    where k.member_id = p_member_id
  );
$$;

-- As before (20261018092300_kyc_review.sql), naming the members whose checks clash through kyc_records_clash.
create or replace function private.kyc_review_queue(p_venue_id uuid)
returns table (
  member_id uuid, full_name text, status text, method text, waiting_because text, date_of_birth date, masked_aadhaar text,
  pan text, address text, photo_path text, liveness_score smallint, face_match_score smallint, vendor_reference text,
  refusal text, clashes_with text[], updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select k.member_id, m.full_name, k.status, k.method,
         case
           when k.status <> 'needs_review' then null
           when k.method = 'pan' then 'pan_alone'
           when k.date_of_birth is null and k.pan is null and k.aadhaar_reference is null then 'nothing_kept'
           when k.date_of_birth is null then 'no_date_of_birth'
           when private.kyc_clashes(k.member_id) then 'clash'
         end,
         k.date_of_birth, k.masked_aadhaar, k.pan, k.address, k.photo_path, k.liveness_score, k.face_match_score,
         k.vendor_reference, k.refusal,
         array(select om.full_name
               from public.kyc_record o join public.member om on om.id = o.member_id
               where private.kyc_records_clash(k, o)
               order by om.full_name),
         k.updated_at
  from public.kyc_record k join public.member m on m.id = k.member_id
  where k.venue_id = p_venue_id and k.status in ('needs_review', 'needs_pan', 'refused')
    and private.has_permission(p_venue_id, 'kyc.review')
  order by (k.status = 'needs_review') desc, k.updated_at;
$$;

revoke execute on function private.kyc_records_clash(public.kyc_record, public.kyc_record) from public, anon, authenticated;
