-- The staff review of identity checks (#31). A check the vendor could not finish on its own waits for
-- staff (needs_review): a PAN alone (#198), a DigiLocker record in another name or with another face,
-- whose details were never kept (decision 0030), or a PAN, Aadhaar reference or face that another
-- unfinished check also holds. A KYC reviewer (kyc.review) at the venue approves or rejects it with a
-- reason, never their own. The gate holds whatever staff decide: under 18, or a PAN, Aadhaar reference
-- or face a verified member holds, is refused (private.kyc_refusal). Each decision is kept in
-- kyc_review, with who made it and why, and the audit log records it (decision 0035).

alter table public.kyc_record
  drop constraint kyc_record_refusal_check,
  add constraint kyc_record_refusal_check
    check (refusal in ('under_18', 'duplicate_face', 'duplicate_pan', 'duplicate_aadhaar', 'staff_rejected'));

create table public.kyc_review (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  decision text not null check (decision in ('approved', 'rejected')),
  -- The reviewer's own words on what they saw, never document numbers.
  reason text not null check (length(trim(reason)) between 3 and 500),
  -- The reviewer entered the date of birth from the original document at the club, because the
  -- vendor's was not kept.
  entered_date_of_birth boolean not null default false,
  -- Where the check ended: verified, or refused (by the reviewer, or by the gate despite approval).
  outcome text not null check (outcome in ('verified', 'refused')),
  reviewed_by_staff_id uuid not null references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.kyc_review is 'A KYC reviewer''s decision on an identity check, with the reason.';

create index kyc_review_venue_id_idx on public.kyc_review (venue_id, created_at);
create index kyc_review_member_id_idx on public.kyc_review (member_id, venue_id);
create index kyc_review_reviewed_by_idx on public.kyc_review (reviewed_by_staff_id);
create trigger kyc_review_touch_updated_at before update on public.kyc_review
  for each row execute function private.touch_updated_at();
create trigger kyc_review_audit after insert or update or delete on public.kyc_review
  for each row execute function private.audit_row_change();

alter table public.kyc_review enable row level security;
-- Reads only: decisions are made through review_kyc below.
grant select on public.kyc_review to authenticated;

create policy "KYC reviewers see the venue's reviews" on public.kyc_review
  for select to authenticated
  using (venue_id in (select private.venues_where('kyc.review')));

-- The checks a KYC reviewer sees at a venue: those waiting for review first, then the stopped
-- (needs_pan) and the refused, oldest first, with what the vendor found and the members whose checks
-- hold the same PAN, Aadhaar reference or face.
create function private.kyc_review_queue(p_venue_id uuid)
returns table (
  member_id uuid, full_name text, status text, method text, date_of_birth date, masked_aadhaar text, pan text,
  address text, photo_path text, liveness_score smallint, face_match_score smallint, refusal text,
  clashes_with text[], updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select k.member_id, m.full_name, k.status, k.method, k.date_of_birth, k.masked_aadhaar, k.pan, k.address, k.photo_path,
         k.liveness_score, k.face_match_score, k.refusal,
         array(select om.full_name
               from public.kyc_record o join public.member om on om.id = o.member_id
               where o.venue_id = k.venue_id and o.member_id <> k.member_id
                 and (o.pan = k.pan or o.aadhaar_reference = k.aadhaar_reference or o.member_id = k.same_face_as)
               order by om.full_name),
         k.updated_at
  from public.kyc_record k join public.member m on m.id = k.member_id
  where k.venue_id = p_venue_id and k.status in ('needs_review', 'needs_pan', 'refused')
    and private.has_permission(p_venue_id, 'kyc.review')
  order by (k.status = 'needs_review') desc, k.updated_at;
$$;

-- A KYC reviewer decides a check waiting for review, with a reason. Approving needs the date of birth
-- from the documents: the vendor's, or, where it was not kept, one the reviewer enters from the original
-- document at the club. The gate then still refuses under 18 and a duplicate of a verified member.
-- Verifying tells the rest of the system (kyc.completed), as private.settle_kyc does.
create function private.review_kyc(p_member_id uuid, p_approve boolean, p_reason text, p_date_of_birth date default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.kyc_record;
  v_refusal text;
  v_status text;
begin
  select * into v_record from public.kyc_record k where k.member_id = p_member_id for update;
  if v_record.id is null or not private.has_permission(v_record.venue_id, 'kyc.review')
     or v_record.member_id = private.current_member_id() then
    raise exception 'Only a KYC reviewer decides a check, never their own' using errcode = '42501';
  end if;
  if v_record.status <> 'needs_review' then
    raise exception 'This check is not waiting for review' using errcode = 'RVKYC';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500
     or (p_date_of_birth is not null and (v_record.date_of_birth is not null or p_date_of_birth not between '1900-01-01' and current_date)) then
    raise exception 'A review needs its reason, and a date of birth only where the check has none' using errcode = '22023';
  end if;
  perform private.assert_writable(v_record.venue_id, null, p_member_id);
  if p_approve and coalesce(v_record.date_of_birth, p_date_of_birth) is null then
    raise exception 'Enter the date of birth from the original document' using errcode = 'RVDOB';
  end if;
  if p_approve then
    update public.kyc_record set date_of_birth = coalesce(date_of_birth, p_date_of_birth) where id = v_record.id;
    -- The clash with another unfinished check is what the reviewer weighed; the gate still holds.
    v_refusal := private.kyc_refusal(p_member_id);
  else
    v_refusal := 'staff_rejected';
  end if;
  v_status := case when v_refusal is null then 'verified' else 'refused' end;
  update public.kyc_record
  set status = v_status, refusal = v_refusal, verified_at = case when v_status = 'verified' then now() end
  where id = v_record.id;
  insert into public.kyc_review (venue_id, member_id, decision, reason, entered_date_of_birth, outcome, reviewed_by_staff_id)
  values (v_record.venue_id, p_member_id, case when p_approve then 'approved' else 'rejected' end, trim(p_reason),
          p_approve and p_date_of_birth is not null, v_status, private.current_staff_id(v_record.venue_id));
  if v_status = 'verified' then
    perform private.emit(v_record.venue_id, 'kyc.completed', jsonb_build_object('member_id', p_member_id),
                         'kyc.completed:' || p_member_id);
  end if;
  return v_status;
end;
$$;

grant execute on function private.kyc_review_queue(uuid), private.review_kyc(uuid, boolean, text, date) to authenticated;

-- Signed-in callers reach them only through these invoker wrappers.
create function public.kyc_review_queue(p_venue_id uuid)
returns table (
  member_id uuid, full_name text, status text, method text, date_of_birth date, masked_aadhaar text, pan text,
  address text, photo_path text, liveness_score smallint, face_match_score smallint, refusal text,
  clashes_with text[], updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.kyc_review_queue(p_venue_id);
$$;

create function public.review_kyc(p_member_id uuid, p_approve boolean, p_reason text, p_date_of_birth date default null)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.review_kyc(p_member_id, p_approve, p_reason, p_date_of_birth);
$$;

grant execute on function public.kyc_review_queue(uuid), public.review_kyc(uuid, boolean, text, date) to authenticated;
