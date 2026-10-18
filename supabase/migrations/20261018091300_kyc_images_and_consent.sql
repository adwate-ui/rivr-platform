-- KYC images and consent (#3; scope-v1 module 1: masked Aadhaar only, the KYC photo, DPDP
-- consent recorded per purpose).

-- KYC images live in a private bucket, one folder per venue and member:
-- <venue_id>/<member_id>/<file>. No client reads, lists or signs objects in it: storage.objects
-- has no policy for the bucket, because a client that may read an object may also mint a signed
-- URL that lasts ten years. Staff ask the kyc-image-url Edge Function instead. It calls
-- authorize_kyc_image below, which checks the permission and writes the audit row, then signs a
-- one-minute URL with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- The venue a KYC object belongs to, from the first folder of its path; null if that is not a uuid.
create function private.kyc_object_venue_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end
$$;

-- Whether the caller may see one KYC image: active staff with KYC review (at review) or the cage
-- (at a withdrawal) at the image's venue. Every view is audited. Refuses with 42501 otherwise.
-- The name must be exactly <venue_id>/<member_id>/<file>.<jpg|png|webp> and an object that exists:
-- a name with `..` would pass a check of its first folder, then resolve to another venue's image
-- once the signing request's URL is normalised.
create function private.authorize_kyc_image(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.kyc_object_venue_id(p_name);
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-]+\.(jpg|png|webp)$'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = p_name)
     or not (private.has_permission(v_venue_id, 'kyc.review') or private.has_permission(v_venue_id, 'cage.transact')) then
    raise exception 'Not allowed to see this KYC image' using errcode = '42501';
  end if;
  perform private.audit(v_venue_id, 'kyc_image.view', 'kyc_image', p_name);
end;
$$;

grant execute on function private.authorize_kyc_image(text) to authenticated;
-- Writes to the bucket: only the KYC flow's Edge Functions, with the service role.

-- Consent per purpose (DPDP). A grant is a row with its time; withdrawing it stamps withdrawn_at
-- and keeps the row as the record. Giving it again later adds a new row.
create table public.consent (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  -- kyc_verification: identity checks with the KYC vendor. marketing: promotional messages, and
  -- the conversion events sent to ad platforms (scope-v1, "Events sent").
  purpose text not null check (purpose in ('kyc_verification', 'marketing')),
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz check (withdrawn_at >= granted_at),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.consent is 'A member''s consent per purpose, with when it was given and withdrawn (DPDP).';

-- One consent in force per member and purpose.
create unique index consent_in_force_idx on public.consent (member_id, purpose) where withdrawn_at is null;
create index consent_venue_id_idx on public.consent (venue_id);
create trigger consent_touch_updated_at before update on public.consent
  for each row execute function private.touch_updated_at();
create trigger consent_audit after insert or update or delete on public.consent
  for each row execute function private.audit_row_change();

alter table public.consent enable row level security;
-- Reads only: consent changes go through give_consent and withdraw_consent.
grant select on public.consent to authenticated;

create policy "members see their own consents" on public.consent
  for select to authenticated
  using (member_id = (select private.current_member_id()));

create policy "staff with member access see the venue's consents" on public.consent
  for select to authenticated
  using (venue_id in (select private.venues_where('members.read')));

-- The signed-in member gives consent for a purpose. Giving it while it is in force changes nothing.
-- Neither consent function calls private.assert_writable: a freeze stops money, seats and hands,
-- never a member's say over their own data.
create function private.give_consent(p_purpose text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
begin
  if v_member_id is null then
    raise exception 'Only a member can give consent' using errcode = '42501';
  end if;
  insert into public.consent (venue_id, member_id, purpose)
  values (private.current_member_venue_id(), v_member_id, p_purpose)
  on conflict (member_id, purpose) where withdrawn_at is null do nothing;
end;
$$;

-- The signed-in member withdraws consent for a purpose. Always allowed, a venue freeze included.
create function private.withdraw_consent(p_purpose text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
begin
  if v_member_id is null then
    raise exception 'Only a member can withdraw consent' using errcode = '42501';
  end if;
  update public.consent set withdrawn_at = now()
  where member_id = v_member_id and purpose = p_purpose and withdrawn_at is null;
end;
$$;

-- True while the member's consent for the purpose is in force. Lane D's consumers call it before
-- sending marketing or conversion events.
create function private.has_consent(p_member_id uuid, p_purpose text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consent c
    where c.member_id = p_member_id and c.purpose = p_purpose and c.withdrawn_at is null
  );
$$;

grant execute on function private.give_consent(text), private.withdraw_consent(text) to authenticated;
grant execute on function private.has_consent(uuid, text) to service_role;

-- Signed-in callers reach the definer functions above only through these invoker wrappers.
create function public.authorize_kyc_image(p_name text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select * from private.authorize_kyc_image(p_name);
$$;

create function public.give_consent(p_purpose text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select * from private.give_consent(p_purpose);
$$;

create function public.withdraw_consent(p_purpose text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select * from private.withdraw_consent(p_purpose);
$$;

grant execute on function public.authorize_kyc_image(text), public.give_consent(text), public.withdraw_consent(text) to authenticated;
