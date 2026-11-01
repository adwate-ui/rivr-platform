-- The KYC review queue keeps the stopped and refused checks of the last 90 days (audit F1-31, 1 Nov). It listed every
-- refused or stopped check for good, each card fetching its photo's signed address, so the list only grew. Every check
-- waiting for review is still listed, however old. As 20261028394800_kyc_manual_recheck.sql, with the 90 days.

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
           when k.pan_recheck in ('pan_invalid', 'name_differs', 'date_of_birth_differs') then 'recheck_' || k.pan_recheck
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
    and (k.status = 'needs_review' or k.updated_at > now() - interval '90 days')
    and private.has_permission(p_venue_id, 'kyc.review')
  order by (k.status = 'needs_review') desc, k.updated_at;
$$;
