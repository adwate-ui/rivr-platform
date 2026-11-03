-- The member's name is the Aadhaar's once DigiLocker verifies them (#803; the owner, 3 Nov, after decision 0400): the
-- card, staff screens and any payout read the legal name, and the name typed at sign-up is kept as what they are known
-- as, for staff. DigiLocker's name is kept on the check only with the member's own face, as the rest of that identity
-- is (decision 0400); it becomes the member's name whenever the check is verified, at once or after a reviewer looks.
-- An Aadhaar name in capitals, as DigiLocker often gives it, is set in ordinary capitals: ASHA RANI VERMA is Asha Rani
-- Verma. Erasure clears both names.

alter table public.member add column known_as text check (known_as is null or (length(btrim(known_as)) between 1 and 120));
comment on column public.member.known_as is
  'The name the member gave at sign-up, kept once their Aadhaar name became their name (#803); for staff.';
alter table public.kyc_record add column aadhaar_name text check (aadhaar_name is null or (length(btrim(aadhaar_name)) between 1 and 120));
comment on column public.kyc_record.aadhaar_name is
  'The name on the Aadhaar DigiLocker returned, kept only with the member''s own face (#803).';
insert into private.member_export_column (table_name, column_name, kind) values
  ('member', 'known_as', 'owed'), ('kyc_record', 'aadhaar_name', 'owed');

-- An erased member holds nothing of the person: no name they were known by either.
alter table public.member drop constraint member_erased_is_anonymous;
alter table public.member add constraint member_erased_is_anonymous check (
  case when erased_at is null then phone is not null
       else phone is null and user_id is null and full_name = 'Erased member' and qualifying_small_blind is null and known_as is null end
);

-- A name as a person's name is written: spaces trimmed and single, and one in capitals set in ordinary capitals, each
-- part after an apostrophe too (D'SOUZA is D'Souza, which initcap alone gives as D'souza).
create function private.legal_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when n = '' then null
    when n = upper(n) then (select string_agg(initcap(part), '''' order by place)
                            from unnest(string_to_array(lower(n), '''')) with ordinality as parts (part, place))
    else n
  end
  from (select regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g') as n) s;
$$;

-- As in 20261104200000_digilocker_approves.sql, with DigiLocker's name kept beside the rest of the identity.
drop function public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, integer, text);
create function public.record_kyc_digilocker(
  p_member_id uuid, p_date_of_birth date, p_masked_aadhaar text, p_aadhaar_reference text, p_pan text, p_address text,
  p_vendor_reference text, p_face_matches boolean, p_face_match_score integer, p_identity_key text default null,
  p_name text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_members_face boolean := coalesce(p_face_matches, false);
begin
  perform private.assert_writable((select m.venue_id from public.member m where m.id = p_member_id), 'kyc_signup', p_member_id);
  update public.kyc_record
  set date_of_birth = case when v_is_members_face then p_date_of_birth end,
      masked_aadhaar = case when v_is_members_face then p_masked_aadhaar end,
      aadhaar_reference = case when v_is_members_face then private.kyc_reference(p_aadhaar_reference) end,
      identity_key = case when v_is_members_face and p_identity_key is not null then private.kyc_reference(p_identity_key) end,
      pan = case when v_is_members_face then p_pan end,
      address = case when v_is_members_face then p_address end,
      aadhaar_name = case when v_is_members_face then left(private.legal_name(p_name), 120) end,
      vendor_reference = p_vendor_reference,
      face_match_score = p_face_match_score
  where member_id = p_member_id and status = 'started' and photo_path is not null;
  if not found then return null; end if;
  return private.settle_kyc(p_member_id, case
    when v_is_members_face and p_date_of_birth is not null and (p_pan is not null or p_identity_key is not null) then 'verified'
    else 'needs_review'
  end);
end;
$$;
revoke execute on function public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.record_kyc_digilocker(uuid, date, text, text, text, text, text, boolean, integer, text, text)
  to service_role;

-- A check verified with an Aadhaar name gives the member that name; the one they gave stays as what they are known as.
create function private.take_aadhaar_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.member m
  set known_as = coalesce(m.known_as, m.full_name), full_name = new.aadhaar_name
  where m.id = new.member_id and m.erased_at is null and m.full_name is distinct from new.aadhaar_name;
  return new;
end;
$$;
create trigger kyc_record_takes_aadhaar_name after update of status on public.kyc_record
  for each row when (new.status = 'verified' and old.status is distinct from 'verified' and new.aadhaar_name is not null)
  execute function private.take_aadhaar_name();
revoke execute on function private.take_aadhaar_name(), private.legal_name(text) from public, anon, authenticated;

-- As in 20261102020000_kyc_vendor_failure.sql, with the Aadhaar name and the name known by erased too.
create or replace function private.anonymise_member(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payout_account p set removed_at = now() where p.member_id = p_member.id and p.removed_at is null;
  update public.consent c set withdrawn_at = now() where c.member_id = p_member.id and c.withdrawn_at is null;
  if exists (select 1 from public.tds_withholding t where t.member_id = p_member.id)
     or exists (select 1 from public.tournament_payout t where t.member_id = p_member.id and t.tds_paise > 0) then
    update public.kyc_record k
    set status = 'erased', refusal = null, verified_at = null, digilocker_session_id = null, date_of_birth = null, masked_aadhaar = null,
        address = null, vendor_reference = null, photo_path = null, liveness_score = null, face_match_score = null,
        aadhaar_reference = null, same_face_as = null, selfie_claimed_at = null, identity_key = null,
        vendor_failure = null, vendor_failed_at = null, aadhaar_name = null
    where k.member_id = p_member.id and k.status <> 'erased';
  else
    delete from public.kyc_record k where k.member_id = p_member.id;
  end if;
  update public.member m
  set full_name = 'Erased member', known_as = null, phone = null, user_id = null, qualifying_small_blind = null,
      qualifying_big_blind = null, erased_at = coalesce(m.erased_at, now())
  where m.id = p_member.id
    and (m.full_name <> 'Erased member' or m.known_as is not null or m.phone is not null or m.user_id is not null
         or m.qualifying_small_blind is not null or m.erased_at is null);
end;
$$;

-- As in 20261103010100_fnb_orders_void_and_serve.sql, with the name a member was known by and the Aadhaar's: an erased
-- member's audit rows hold neither (the member's audit logs the name change; the check's logs the Aadhaar name).
create or replace function private.strip_erased_fields(p_state jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_state) = 'object'
    then p_state - array['full_name', 'phone', 'note', 'resolution', 'reason', 'release_reason', 'lift_reason', 'proposal_reason',
                         'decline_reason', 'reject_reason', 'buyer_name', 'signature_svg', 'vendor_reference', 'digilocker_session_id',
                         'address', 'cancel_reason', 'known_as', 'aadhaar_name']
    else p_state end;
$$;

-- As in 20261019092800_member_record.sql, with the name the member is known by.
drop function public.member_record(uuid, uuid);
drop function private.member_record(uuid, uuid);
create function private.member_record(p_venue_id uuid, p_member_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_id uuid, tier_name text, tier_until date,
               qualifying_small_blind bigint, qualifying_big_blind bigint, is_kyc_complete boolean, photo_path text, visits integer,
               last_visit_at timestamptz, is_in_room boolean, early_departures integer, known_as text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.member_number, m.full_name, m.phone, t.id, t.name,
         (select ((c.ends_at at time zone 'Asia/Kolkata') - interval '1 day')::date from public.member_tier_change c
          where c.member_id = m.id and not c.is_expiry and (c.ends_at is null or c.ends_at > now()) order by c.created_at desc limit 1),
         m.qualifying_small_blind, m.qualifying_big_blind, private.is_kyc_complete(m.id), k.photo_path,
         (select count(*)::integer from public.visit v where v.member_id = m.id),
         (select max(v.opened_at) from public.visit v where v.member_id = m.id),
         private.current_visit(m.id) is not null,
         (select count(*)::integer from public.early_departure e where e.member_id = m.id),
         m.known_as
  from public.member m
  join public.tier t on t.id = m.tier_id
  left join public.kyc_record k on k.member_id = m.id
  where m.id = p_member_id and m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read');
$$;
create function public.member_record(p_venue_id uuid, p_member_id uuid)
returns table (member_id uuid, member_number bigint, full_name text, phone text, tier_id uuid, tier_name text, tier_until date,
               qualifying_small_blind bigint, qualifying_big_blind bigint, is_kyc_complete boolean, photo_path text, visits integer,
               last_visit_at timestamptz, is_in_room boolean, early_departures integer, known_as text)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_record(p_venue_id, p_member_id); $$;
revoke execute on function private.member_record(uuid, uuid), public.member_record(uuid, uuid) from public, anon;
grant execute on function private.member_record(uuid, uuid), public.member_record(uuid, uuid) to authenticated;

-- The practice venue's seed keeps the new columns (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
