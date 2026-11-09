-- PAN and Aadhaar photos at the desk check (the owner, 9 Nov; decision 0573). The typed PAN and last four Aadhaar digits stay as they
-- were. The files sit in the member's folder of the private kyc bucket, so erasure and a venue purge take them with the rest. Only
-- super admins open them, through authorize_kyc_image, which audits each opening. The Aadhaar's bars are painted in on the phone, so
-- no unmasked photo reaches here: the server cannot read a picture, so it holds who said the bars are in place.

create table public.kyc_document (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null,
  kind text not null check (kind in ('pan', 'aadhaar_front')),
  path text not null,
  taken_by_staff_id uuid not null,
  covers_confirmed_by_staff_id uuid,
  retake_asked_at timestamptz,
  retake_asked_by_staff_id uuid,
  retake_reason text check (retake_reason is null or length(btrim(retake_reason)) between 3 and 200),
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, kind),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (taken_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (covers_confirmed_by_staff_id, venue_id) references public.staff (id, venue_id),
  foreign key (retake_asked_by_staff_id, venue_id) references public.staff (id, venue_id),
  check ((kind = 'aadhaar_front') = (covers_confirmed_by_staff_id is not null)),
  check ((retake_asked_at is null) = (retake_asked_by_staff_id is null) and (retake_asked_at is null) = (retake_reason is null))
);

comment on table public.kyc_document is 'A member''s PAN or Aadhaar photo from the desk check (decision 0573): read only through private.member_kyc_documents and authorize_kyc_image.';
create index kyc_document_venue_idx on public.kyc_document (venue_id, member_id);
alter table public.kyc_document enable row level security;
revoke all on public.kyc_document from anon, authenticated;
create trigger kyc_document_touch_updated_at before update on public.kyc_document
  for each row execute function private.touch_updated_at();
create trigger kyc_document_audit after insert or update or delete on public.kyc_document
  for each row execute function private.audit_row_change();

-- What a member's own data export gives: that a document is on file, not where or who took it.
insert into private.member_export_column (table_name, column_name, kind) values
  ('kyc_document', 'id', 'owed'), ('kyc_document', 'venue_id', 'owed'), ('kyc_document', 'member_id', 'owed'), ('kyc_document', 'kind', 'owed'),
  ('kyc_document', 'taken_at', 'owed'), ('kyc_document', 'created_at', 'owed'), ('kyc_document', 'updated_at', 'owed'),
  ('kyc_document', 'path', 'withheld'), ('kyc_document', 'taken_by_staff_id', 'withheld'), ('kyc_document', 'covers_confirmed_by_staff_id', 'withheld'),
  ('kyc_document', 'retake_asked_at', 'withheld'), ('kyc_document', 'retake_asked_by_staff_id', 'withheld'), ('kyc_document', 'retake_reason', 'withheld');

-- An erased member's documents go with them; member-erase removes the folder of files.
create function private.forget_erased_kyc_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.kyc_document d where d.member_id = new.id;
  return null;
end;
$$;
revoke execute on function private.forget_erased_kyc_documents() from public, anon, authenticated;
create trigger kyc_documents_go_on_erasure after update of erased_at on public.member
  for each row when (old.erased_at is null and new.erased_at is not null) execute function private.forget_erased_kyc_documents();

-- This check's own file, of this member, stored in the last ten minutes.
create function private.kyc_document_is_stored(p_member_id uuid, p_venue_id uuid, p_kind text, p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_path, '') ~ ('^' || p_venue_id::text || '/' || p_member_id::text || '/doc-' || case p_kind when 'pan' then 'pan' else 'aadhaar' end || '-[0-9a-f-]{36}\.jpg$')
         and exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = p_path and o.created_at > now() - interval '10 minutes');
$$;
revoke execute on function private.kyc_document_is_stored(uuid, uuid, text, text) from public, anon, authenticated;

-- As 20261110110000_kyc_needs_pan_at_the_desk.sql made it, with the PAN and Aadhaar photos and the word that the bars are in place.
drop function public.check_kyc_in_person(uuid, text, date, text, text, boolean);
drop function private.check_kyc_in_person(uuid, text, date, text, text, boolean);
create function private.check_kyc_in_person(p_member_id uuid, p_photo_path text, p_date_of_birth date, p_aadhaar_last4 text,
  p_pan text, p_consent boolean,
  p_pan_photo_path text default null, p_aadhaar_photo_path text default null, p_covers_confirmed boolean default false)
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
  if not (private.kyc_document_is_stored(p_member_id, v_venue_id, 'pan', p_pan_photo_path)
          and private.kyc_document_is_stored(p_member_id, v_venue_id, 'aadhaar_front', p_aadhaar_photo_path)) then
    raise exception 'Photograph the PAN and the Aadhaar first' using errcode = 'RVPHT';
  end if;
  if p_covers_confirmed is not true then
    raise exception 'Say the bars hide the first eight digits and the QR code' using errcode = '22023';
  end if;
  insert into public.kyc_record (venue_id, member_id, status, method, photo_path, date_of_birth, masked_aadhaar, pan)
  values (v_venue_id, p_member_id, 'started', 'manual', p_photo_path, p_date_of_birth, 'XXXX XXXX ' || p_aadhaar_last4,
          upper(trim(p_pan)))
  on conflict (member_id) do update
  set status = 'started', method = 'manual', photo_path = excluded.photo_path, date_of_birth = excluded.date_of_birth,
      masked_aadhaar = excluded.masked_aadhaar, pan = excluded.pan, refusal = null, verified_at = null,
      aadhaar_name = null, aadhaar_reference = null, identity_key = null, address = null, vendor_reference = null,
      liveness_score = null, face_match_score = null, digilocker_session_id = null, pan_recheck = null, pan_rechecked_at = null
  where public.kyc_record.status in ('started', 'needs_pan');
  if not found then
    raise exception 'This member''s check is decided or waits for review' using errcode = 'RVKYC';
  end if;
  insert into public.consent (venue_id, member_id, purpose, recorded_by_staff_id)
  values (v_venue_id, p_member_id, 'kyc_verification', v_staff_id)
  on conflict (member_id, purpose) where withdrawn_at is null do nothing;
  insert into public.kyc_document (venue_id, member_id, kind, path, taken_by_staff_id, covers_confirmed_by_staff_id)
  values (v_venue_id, p_member_id, 'pan', p_pan_photo_path, v_staff_id, null),
         (v_venue_id, p_member_id, 'aadhaar_front', p_aadhaar_photo_path, v_staff_id, v_staff_id)
  on conflict (member_id, kind) do update
  set path = excluded.path, taken_at = now(), taken_by_staff_id = excluded.taken_by_staff_id, covers_confirmed_by_staff_id = excluded.covers_confirmed_by_staff_id,
      retake_asked_at = null, retake_asked_by_staff_id = null, retake_reason = null;
  v_status := private.settle_kyc(p_member_id, 'verified', false);
  insert into public.kyc_review (venue_id, member_id, decision, reason, entered_date_of_birth, entered_pan, outcome, reviewed_by_staff_id, method)
  values (v_venue_id, p_member_id, 'approved', 'Checked in person against the original documents at the club', true, true,
          v_status, v_staff_id, 'manual');
  return v_status;
end;
$$;

create function public.check_kyc_in_person(p_member_id uuid, p_photo_path text, p_date_of_birth date, p_aadhaar_last4 text, p_pan text, p_consent boolean,
  p_pan_photo_path text default null, p_aadhaar_photo_path text default null, p_covers_confirmed boolean default false)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$ select private.check_kyc_in_person(p_member_id, p_photo_path, p_date_of_birth, p_aadhaar_last4, p_pan, p_consent, p_pan_photo_path, p_aadhaar_photo_path, p_covers_confirmed); $$;
revoke execute on function private.check_kyc_in_person(uuid, text, date, text, text, boolean, text, text, boolean),
  public.check_kyc_in_person(uuid, text, date, text, text, boolean, text, text, boolean) from public, anon;
grant execute on function private.check_kyc_in_person(uuid, text, date, text, text, boolean, text, text, boolean),
  public.check_kyc_in_person(uuid, text, date, text, text, boolean, text, text, boolean) to authenticated;

-- As 20261108110000_kyc_at_the_club.sql made it, with a member's documents for super admins alone.
create or replace function private.authorize_kyc_image(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.kyc_object_venue_id(p_name);
  v_is_staff boolean := private.has_permission(v_venue_id, 'kyc.review') or private.has_permission(v_venue_id, 'cage.transact')
                        or (private.has_permission(v_venue_id, 'kyc.in_person')
                            and (p_name ~ '/photo\.jpg$'
                                 -- The selfie of a member reopened for the desk, who may have no sign-up photo.
                                 or exists (select 1 from public.kyc_record k where k.photo_path = p_name and k.status = 'started'
                                              and k.at_club_from is not null)));
begin
  -- A member's PAN and Aadhaar photos are for super admins alone, whoever took them (the owner, 9 Nov).
  if p_name ~ '/doc-(pan|aadhaar)-[0-9a-f-]{36}\.jpg$' and not coalesce(private.is_super_admin(v_venue_id), false) then
    raise exception 'Not allowed to see this KYC image' using errcode = '42501';
  end if;
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-]+\.(jpg|png|webp)$'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = p_name)
     or not (v_is_staff
             or exists (select 1 from public.kyc_record k
                        where k.member_id = private.current_member_id() and k.venue_id = v_venue_id
                          and k.status = 'verified' and k.photo_path = p_name)) then
    raise exception 'Not allowed to see this KYC image' using errcode = '42501';
  end if;
  -- One of the member's views at a time, so calls made together cannot all count the same views and all pass.
  if not v_is_staff then
    perform pg_advisory_xact_lock(hashtextextended('kyc-view:' || (select auth.uid())::text, 0));
  end if;
  if not v_is_staff and (select count(*) from public.audit_log a
                         where a.entity = 'kyc_image' and a.entity_id = p_name and a.action = 'kyc_image.view'
                           and a.actor_user_id = (select auth.uid()) and a.occurred_at > now() - interval '1 minute') >= 10 then
    raise exception 'Ten views of your photo a minute at most. Try again shortly.' using errcode = 'RVRAT';
  end if;
  perform private.audit(v_venue_id, 'kyc_image.view', 'kyc_image', p_name);
end;
$$;

-- A super admin reads what is on file.
create function private.member_kyc_documents(p_venue_id uuid, p_member_id uuid)
returns table (kind text, path text, taken_at timestamptz, taken_by text, covers_confirmed_by text, retake_asked_at timestamptz, retake_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.kind, d.path, d.taken_at, taken.full_name, confirmed.full_name, d.retake_asked_at, d.retake_reason
  from public.kyc_document d
  join public.staff taken on taken.id = d.taken_by_staff_id
  left join public.staff confirmed on confirmed.id = d.covers_confirmed_by_staff_id
  where d.venue_id = p_venue_id and d.member_id = p_member_id and private.is_super_admin(p_venue_id)
  order by d.kind;
$$;
create function public.member_kyc_documents(p_venue_id uuid, p_member_id uuid)
returns table (kind text, path text, taken_at timestamptz, taken_by text, covers_confirmed_by text, retake_asked_at timestamptz, retake_reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_kyc_documents(p_venue_id, p_member_id); $$;

-- A super admin sends a photo back, saying why in words: the member is due at the desk for it again.
create function private.ask_kyc_document_retake(p_member_id uuid, p_kind text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id and m.erased_at is null);
begin
  if v_venue_id is null or not private.is_super_admin(v_venue_id) then
    raise exception 'Only a super admin sends a document back' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 200 or p_reason ~ '[0-9]' then
    raise exception 'A reason of 3 to 200 characters, in words' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id);
  update public.kyc_document
  set retake_asked_at = now(), retake_asked_by_staff_id = private.current_staff_id(v_venue_id), retake_reason = btrim(p_reason)
  where member_id = p_member_id and kind = p_kind;
  if not found then
    raise exception 'No such document on file' using errcode = '22023';
  end if;
end;
$$;
create function public.ask_kyc_document_retake(p_member_id uuid, p_kind text, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.ask_kyc_document_retake(p_member_id, p_kind, p_reason); $$;

-- Who may retake a photo sent back: staff who check members in person, never for themselves or a member they added or changed.
create function private.assert_may_retake_kyc_document(p_member_id uuid, p_kind text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id and m.erased_at is null);
begin
  if v_venue_id is null
     or not (private.has_permission(v_venue_id, 'kyc.in_person') or private.has_permission(v_venue_id, 'kyc.review'))
     or private.is_own_kyc_check(p_member_id) or private.changed_member(p_member_id) then
    raise exception 'Only staff who check members in person do, never for themselves or a member they added or changed' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, 'kyc_signup'::public.killable_feature, p_member_id);
  if not exists (select 1 from public.kyc_document d where d.member_id = p_member_id and d.kind = p_kind and d.retake_asked_at is not null) then
    raise exception 'This photo was not sent back' using errcode = 'RVKYC';
  end if;
  -- Two people, as for a reopened check: whoever sent it back does not also replace it, and so remove the first.
  if exists (select 1 from public.kyc_document d where d.member_id = p_member_id and d.kind = p_kind
               and d.retake_asked_by_staff_id = private.current_staff_id(v_venue_id)) then
    raise exception 'Someone else takes again a photo you sent back' using errcode = '42501';
  end if;
  return v_venue_id;
end;
$$;
revoke execute on function private.assert_may_retake_kyc_document(uuid, text) from public, anon, authenticated;

create function private.authorize_kyc_document_retake(p_member_id uuid, p_kind text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.assert_may_retake_kyc_document(p_member_id, p_kind);
begin
  return v_venue_id::text || '/' || p_member_id::text || '/doc-' || case p_kind when 'pan' then 'pan' else 'aadhaar' end || '-' || gen_random_uuid()::text || '.jpg';
end;
$$;
create function public.authorize_kyc_document_retake(p_member_id uuid, p_kind text)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.authorize_kyc_document_retake(p_member_id, p_kind); $$;

-- The new photo on file. The function then clears the old file, as no row names it.
create function private.record_kyc_document_retake(p_member_id uuid, p_kind text, p_path text, p_covers_confirmed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.assert_may_retake_kyc_document(p_member_id, p_kind);
  v_staff_id uuid := private.current_staff_id(v_venue_id);
begin
  if not private.kyc_document_is_stored(p_member_id, v_venue_id, p_kind, p_path) then
    raise exception 'Take the photo first' using errcode = 'RVPHT';
  end if;
  if p_kind = 'aadhaar_front' and p_covers_confirmed is not true then
    raise exception 'Say the bars hide the first eight digits and the QR code' using errcode = '22023';
  end if;
  update public.kyc_document
  set path = p_path, taken_at = now(), taken_by_staff_id = v_staff_id, covers_confirmed_by_staff_id = case when p_kind = 'aadhaar_front' then v_staff_id end,
      retake_asked_at = null, retake_asked_by_staff_id = null, retake_reason = null
  where member_id = p_member_id and kind = p_kind;
end;
$$;
create function public.record_kyc_document_retake(p_member_id uuid, p_kind text, p_path text, p_covers_confirmed boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_kyc_document_retake(p_member_id, p_kind, p_path, p_covers_confirmed); $$;

revoke execute on function private.member_kyc_documents(uuid, uuid), public.member_kyc_documents(uuid, uuid),
  private.ask_kyc_document_retake(uuid, text, text), public.ask_kyc_document_retake(uuid, text, text),
  private.authorize_kyc_document_retake(uuid, text), public.authorize_kyc_document_retake(uuid, text),
  private.record_kyc_document_retake(uuid, text, text, boolean), public.record_kyc_document_retake(uuid, text, text, boolean) from public, anon;
grant execute on function private.member_kyc_documents(uuid, uuid), public.member_kyc_documents(uuid, uuid),
  private.ask_kyc_document_retake(uuid, text, text), public.ask_kyc_document_retake(uuid, text, text),
  private.authorize_kyc_document_retake(uuid, text), public.authorize_kyc_document_retake(uuid, text),
  private.record_kyc_document_retake(uuid, text, text, boolean), public.record_kyc_document_retake(uuid, text, text, boolean) to authenticated;

-- As 20261110110000_kyc_needs_pan_at_the_desk.sql made them, with the photos a verified member is due to retake.
drop function public.kyc_in_person_candidates(uuid, text);
drop function private.kyc_in_person_candidates(uuid, text);
drop function public.kyc_due_tonight(uuid);
drop function private.kyc_due_tonight(uuid);
create function private.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text, retake_kinds text[], retake_reasons text[])
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, right(m.phone, 4), k.status,
         case when k.at_club_from is not null then
           case when exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = m.venue_id || '/' || m.id || '/photo.jpg')
                then m.venue_id || '/' || m.id || '/photo.jpg'
                else k.photo_path end
         end,
         array(select d.kind from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null order by d.kind),
         array(select d.retake_reason from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null order by d.kind)
  from public.member m left join public.kyc_record k on k.member_id = m.id
  where m.venue_id = p_venue_id and m.erased_at is null
    and (private.has_permission(p_venue_id, 'kyc.in_person') or private.has_permission(p_venue_id, 'kyc.review'))
    and (k.id is null or k.status = 'started' or (k.status = 'needs_pan' and private.kyc_at_the_club(p_venue_id, now()))
         or exists (select 1 from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null))
    -- Null for a reviewer with no member record of their own, which is not their own check.
    and private.is_own_kyc_check(m.id) is not true
    and not private.changed_member(m.id)
    and length(trim(p_search)) between 2 and 100
    -- position, not like: a search is text, never a pattern.
    and (position(lower(trim(p_search)) in lower(m.full_name)) > 0
         or (trim(p_search) ~ '^([0-9]{4}|[0-9]{10})$' and right(m.phone, length(trim(p_search))) = trim(p_search)))
  order by m.full_name
  limit 20;
$$;

create function public.kyc_in_person_candidates(p_venue_id uuid, p_search text)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text, retake_kinds text[], retake_reasons text[])
language sql
security invoker
set search_path = ''
as $$
  select * from private.kyc_in_person_candidates(p_venue_id, p_search);
$$;

create function private.kyc_due_tonight(p_venue_id uuid)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text, retake_kinds text[], retake_reasons text[])
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.full_name, right(m.phone, 4), k.status,
         case when k.at_club_from is not null then
           case when exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = m.venue_id || '/' || m.id || '/photo.jpg')
                then m.venue_id || '/' || m.id || '/photo.jpg'
                else k.photo_path end
         end,
         array(select d.kind from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null order by d.kind),
         array(select d.retake_reason from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null order by d.kind)
  from public.member m left join public.kyc_record k on k.member_id = m.id
  where m.venue_id = p_venue_id and m.erased_at is null
    and (private.has_permission(p_venue_id, 'kyc.in_person') or private.has_permission(p_venue_id, 'kyc.review'))
    and (k.id is null or k.status = 'started' or (k.status = 'needs_pan' and private.kyc_at_the_club(p_venue_id, now()))
         or exists (select 1 from public.kyc_document d where d.member_id = m.id and d.retake_asked_at is not null))
    and private.is_own_kyc_check(m.id) is not true
    and not private.changed_member(m.id)
    and (private.current_visit(m.id) is not null
         or exists (select 1 from public.waitlist_entry e where e.member_id = m.id and e.left_at is null and e.seated_at is null))
  order by coalesce(k.at_club_from, k.created_at, m.created_at), m.full_name
  limit 50;
$$;

create function public.kyc_due_tonight(p_venue_id uuid)
returns table (member_id uuid, full_name text, phone_last4 text, status text, app_selfie_path text, retake_kinds text[], retake_reasons text[])
language sql
stable
set search_path = ''
as $$ select * from private.kyc_due_tonight(p_venue_id); $$;

revoke execute on function private.kyc_in_person_candidates(uuid, text), public.kyc_in_person_candidates(uuid, text) from public, anon;
grant execute on function private.kyc_in_person_candidates(uuid, text), public.kyc_in_person_candidates(uuid, text) to authenticated;
revoke execute on function private.kyc_due_tonight(uuid), public.kyc_due_tonight(uuid) from public, anon;
grant execute on function private.kyc_due_tonight(uuid), public.kyc_due_tonight(uuid) to authenticated;

-- A desk check needs someone to check: as in 20261110110000_kyc_needs_pan_at_the_desk.sql, never an erased member, whose new
-- photos nothing would remove.
create or replace function private.assert_may_check_in_person(p_member_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id and m.erased_at is null);
  v_status text := (select k.status from public.kyc_record k where k.member_id = p_member_id);
begin
  if v_venue_id is null
     or not (private.has_permission(v_venue_id, 'kyc.in_person') or private.has_permission(v_venue_id, 'kyc.review'))
     or private.is_own_kyc_check(p_member_id) or private.changed_member(p_member_id) then
    raise exception 'Only staff who check members in person do, never for themselves or a member they added or changed'
      using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, 'kyc_signup'::public.killable_feature, p_member_id);
  if v_status is not null and v_status <> 'started'
     and not (v_status = 'needs_pan' and private.kyc_at_the_club(v_venue_id, now())) then
    raise exception 'This member''s check is decided or waits for review' using errcode = 'RVKYC';
  end if;
end;
$$;

-- As in 20261104210000_aadhaar_name.sql, with why a photo was sent back, which a super admin writes in their own words.
create or replace function private.strip_erased_fields(p_state jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_state) = 'object'
    then p_state - array['full_name', 'phone', 'note', 'resolution', 'reason', 'release_reason', 'lift_reason', 'proposal_reason',
                         'decline_reason', 'reject_reason', 'buyer_name', 'signature_svg', 'vendor_reference', 'digilocker_session_id',
                         'address', 'cancel_reason', 'known_as', 'aadhaar_name', 'retake_reason']
    else p_state end;
$$;
