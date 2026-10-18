-- The staff review of identity checks (#31, decision 0035). A check the vendor could not finish alone
-- waits for staff (needs_review): a PAN alone (#198), a DigiLocker record in another name or face whose
-- details were never kept (decision 0030), or a PAN, Aadhaar reference or face that another unfinished
-- check also holds. A KYC reviewer (kyc.review) at the venue approves or rejects it with a reason,
-- never their own. Approving goes through private.settle_kyc like every verification, so the gate
-- still refuses under 18 and any PAN, Aadhaar reference or face a verified member holds; it needs the
-- date of birth and the PAN, which the reviewer enters from the original documents where the check
-- kept none. Each decision is kept in kyc_review; the audit log keeps it without the reason.

alter table public.kyc_record
  drop constraint kyc_record_refusal_check,
  add constraint kyc_record_refusal_check
    check (refusal in ('under_18', 'duplicate_face', 'duplicate_pan', 'duplicate_aadhaar', 'staff_rejected'));

-- As in 20261018091700 (the venue's minimum age), and a face the vendor matched now counts both ways:
-- the member this check's search found, and any member whose own search found this one, so the order
-- two checks arrive in never lets both through.
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
                   and (o.member_id = k.same_face_as or o.same_face_as = k.member_id))
      then 'duplicate_face'
  end
  from public.kyc_record k join public.venue v on v.id = k.venue_id
  where k.member_id = p_member_id;
$$;

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
    join public.kyc_record o on o.venue_id = k.venue_id and o.member_id <> k.member_id
    where k.member_id = p_member_id
      and (o.pan = k.pan or o.aadhaar_reference = k.aadhaar_reference
           or o.member_id = k.same_face_as or o.same_face_as = k.member_id)
  );
$$;

-- Moves a check on to the status asked for, unless the gate refuses it. Verifying needs a date of
-- birth from the documents and, unless a KYC reviewer has weighed it (p_reviewed), no clash with
-- another member's check. One check settles at a time in a venue, so two checks with one face can
-- never both pass. Verifying stamps the time and tells the rest of the system (kyc.completed).
drop function private.settle_kyc(uuid, text);
create function private.settle_kyc(p_member_id uuid, p_status text, p_reviewed boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select k.venue_id from public.kyc_record k where k.member_id = p_member_id);
  v_refusal text;
  v_status text := p_status;
  v_record public.kyc_record;
begin
  perform pg_advisory_xact_lock(hashtext('kyc-settle:' || v_venue_id::text));
  v_refusal := private.kyc_refusal(p_member_id);
  if v_refusal is not null then
    v_status := 'refused';
  elsif p_status = 'verified'
    and ((select k.date_of_birth from public.kyc_record k where k.member_id = p_member_id) is null
         or (not p_reviewed and private.kyc_clashes(p_member_id))) then
    v_status := 'needs_review';
  end if;
  update public.kyc_record
  set status = v_status, refusal = v_refusal,
      verified_at = case when v_status = 'verified' then now() end
  where member_id = p_member_id
  returning * into v_record;
  if v_record.status = 'verified' then
    perform private.emit(v_record.venue_id, 'kyc.completed', jsonb_build_object('member_id', p_member_id),
                         'kyc.completed:' || p_member_id);
  end if;
  return v_record.status;
end;
$$;

create table public.kyc_review (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  decision text not null check (decision in ('approved', 'rejected')),
  -- The reviewer's own words on what they saw: never a document number, which the screen says and
  -- this refuses (twelve digits as an Aadhaar has, or a PAN's shape).
  reason text not null check (
    length(trim(reason)) between 3 and 500
    and reason !~ '[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}'
    and reason !~* '[a-z]{5}[0-9]{4}[a-z]'
  ),
  -- The reviewer entered the date of birth, or the PAN, from the original document at the club,
  -- because the check kept none.
  entered_date_of_birth boolean not null default false,
  entered_pan boolean not null default false,
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

-- The audit log is append-only and outlives an erasure request, so it records the decision, never the
-- reason, which is the reviewer's free words about a person.
create function private.audit_kyc_review_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.kyc_review := coalesce(new, old);
  safe text[] := array['id', 'member_id', 'decision', 'entered_date_of_birth', 'entered_pan', 'outcome', 'reviewed_by_staff_id'];
begin
  perform private.audit(
    changed.venue_id, lower(tg_op), 'kyc_review', changed.id::text,
    case when tg_op <> 'INSERT' then (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(old)) as e (k, v) where k = any (safe)) end,
    case when tg_op <> 'DELETE' then (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(new)) as e (k, v) where k = any (safe)) end
  );
  return null;
end;
$$;

create trigger kyc_review_audit after insert or update or delete on public.kyc_review
  for each row execute function private.audit_kyc_review_change();

alter table public.kyc_review enable row level security;
-- Reads only: decisions are made through review_kyc below.
grant select on public.kyc_review to authenticated;

create policy "KYC reviewers see the venue's reviews" on public.kyc_review
  for select to authenticated
  using (venue_id in (select private.venues_where('kyc.review')));

-- The checks a KYC reviewer sees at a venue: those waiting for review first, then the stopped
-- (needs_pan) and the refused, oldest first; with what the vendor found, why each waits, and the
-- members whose checks hold the same PAN, Aadhaar reference or face, either way.
create function private.kyc_review_queue(p_venue_id uuid)
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
           when k.date_of_birth is null and k.pan is null then 'nothing_kept'
           when k.date_of_birth is null then 'no_date_of_birth'
           when private.kyc_clashes(k.member_id) then 'clash'
         end,
         k.date_of_birth, k.masked_aadhaar, k.pan, k.address, k.photo_path, k.liveness_score, k.face_match_score,
         k.vendor_reference, k.refusal,
         array(select om.full_name
               from public.kyc_record o join public.member om on om.id = o.member_id
               where o.venue_id = k.venue_id and o.member_id <> k.member_id
                 and (o.pan = k.pan or o.aadhaar_reference = k.aadhaar_reference
                      or o.member_id = k.same_face_as or o.same_face_as = k.member_id)
               order by om.full_name),
         k.updated_at
  from public.kyc_record k join public.member m on m.id = k.member_id
  where k.venue_id = p_venue_id and k.status in ('needs_review', 'needs_pan', 'refused')
    and private.has_permission(p_venue_id, 'kyc.review')
  order by (k.status = 'needs_review') desc, k.updated_at;
$$;

-- Whether the signed-in person decides their own check: their member record, or a member with the
-- phone or the name of one of their staff records (a second number of their own).
create function private.is_own_kyc_check(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_member_id = private.current_member_id()
    or exists (select 1
               from public.member m join public.staff s on s.user_id = (select auth.uid())
               where m.id = p_member_id
                 and (s.phone = m.phone or lower(trim(s.full_name)) = lower(trim(m.full_name))));
$$;

-- A KYC reviewer decides a check waiting for review, with a reason. Approving needs the date of
-- birth and the PAN from the documents: the vendor's, or, where the check kept none, the ones the
-- reviewer enters from the originals at the club; then private.settle_kyc verifies it unless the gate
-- refuses. Rejecting refuses the check. The KYC sign-up kill switch stops approvals, not rejections.
create function private.review_kyc(
  p_member_id uuid, p_approve boolean, p_reason text, p_date_of_birth date default null, p_pan text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record public.kyc_record;
  v_status text;
begin
  select * into v_record from public.kyc_record k where k.member_id = p_member_id for update;
  if v_record.id is null or not private.has_permission(v_record.venue_id, 'kyc.review') or private.is_own_kyc_check(p_member_id) then
    raise exception 'Only a KYC reviewer decides a check, never their own' using errcode = '42501';
  end if;
  if v_record.status <> 'needs_review' then
    raise exception 'This check is not waiting for review' using errcode = 'RVKYC';
  end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500
     or p_reason ~ '[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}' or p_reason ~* '[a-z]{5}[0-9]{4}[a-z]'
     or (p_date_of_birth is not null and (v_record.date_of_birth is not null or p_date_of_birth not between '1900-01-01' and current_date))
     or (p_pan is not null and (v_record.pan is not null or upper(trim(p_pan)) !~ '^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$')) then
    raise exception 'A review needs its reason, with no document numbers, and a date of birth or PAN only where the check has none'
      using errcode = '22023';
  end if;
  perform private.assert_writable(v_record.venue_id, case when p_approve then 'kyc_signup'::public.killable_feature end, p_member_id);
  if p_approve and coalesce(v_record.date_of_birth, p_date_of_birth) is null then
    raise exception 'Enter the date of birth from the original document' using errcode = 'RVDOB';
  end if;
  if p_approve and coalesce(v_record.pan, p_pan) is null then
    raise exception 'Enter the PAN from the original PAN card' using errcode = 'RVPAN';
  end if;
  if p_approve then
    update public.kyc_record
    set date_of_birth = coalesce(date_of_birth, p_date_of_birth), pan = coalesce(pan, upper(trim(p_pan)))
    where id = v_record.id;
    v_status := private.settle_kyc(p_member_id, 'verified', true);
  else
    update public.kyc_record set status = 'refused', refusal = 'staff_rejected', verified_at = null where id = v_record.id;
    v_status := 'refused';
  end if;
  insert into public.kyc_review (venue_id, member_id, decision, reason, entered_date_of_birth, entered_pan, outcome, reviewed_by_staff_id)
  values (v_record.venue_id, p_member_id, case when p_approve then 'approved' else 'rejected' end, trim(p_reason),
          p_approve and p_date_of_birth is not null, p_approve and p_pan is not null, v_status,
          private.current_staff_id(v_record.venue_id));
  return v_status;
end;
$$;

grant execute on function private.kyc_review_queue(uuid), private.review_kyc(uuid, boolean, text, date, text) to authenticated;

-- Signed-in callers reach them only through these invoker wrappers.
create function public.kyc_review_queue(p_venue_id uuid)
returns table (
  member_id uuid, full_name text, status text, method text, waiting_because text, date_of_birth date, masked_aadhaar text,
  pan text, address text, photo_path text, liveness_score smallint, face_match_score smallint, vendor_reference text,
  refusal text, clashes_with text[], updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.kyc_review_queue(p_venue_id);
$$;

create function public.review_kyc(
  p_member_id uuid, p_approve boolean, p_reason text, p_date_of_birth date default null, p_pan text default null
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.review_kyc(p_member_id, p_approve, p_reason, p_date_of_birth, p_pan);
$$;

grant execute on function public.kyc_review_queue(uuid), public.review_kyc(uuid, boolean, text, date, text) to authenticated;
