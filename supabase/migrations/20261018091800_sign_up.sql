-- Sign-up (#10, question #211; scope-v1 module 1, "Mobile OTP sign-up", and "Growth"). A number with
-- no member record becomes a member of the club's venue, never the practice venue, named as on their
-- Aadhaar, which KYC checks DigiLocker's name against; KYC still gates every seat. The codes from the
-- link the player arrived by (referral, creator, UTM) are kept with the sign-up, and member.signed_up
-- carries them to lane D's funnel. A number staff already registered at the club links to its record,
-- as at every sign-in, and is not a sign-up; a practice-venue record never links to a real login. A
-- staff login does not sign itself up as a player (question #216).

-- A code from a link: letters, digits, spaces and _ . + -, at most 64 (@rivr/contracts attributionFrom).
create domain public.attribution_code as text check (value ~ '^[A-Za-z0-9 _.+-]{1,64}$');

create table public.sign_up_attribution (
  member_id uuid primary key,
  -- The audit log's entity id.
  id uuid not null default gen_random_uuid() unique,
  venue_id uuid not null,
  referral_code public.attribution_code,
  creator_code public.attribution_code,
  utm_source public.attribution_code,
  utm_medium public.attribution_code,
  utm_campaign public.attribution_code,
  utm_content public.attribution_code,
  utm_term public.attribution_code,
  -- When the player first opened a link with codes, as their browser recorded it; null when it was
  -- not a real time or more than 30 days ago.
  first_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.sign_up_attribution is 'The referral, creator and UTM codes a member signed up with (first touch).';

create index sign_up_attribution_venue_id_idx on public.sign_up_attribution (venue_id);
create trigger sign_up_attribution_touch_updated_at before update on public.sign_up_attribution
  for each row execute function private.touch_updated_at();
create trigger sign_up_attribution_audit after insert or update or delete on public.sign_up_attribution
  for each row execute function private.audit_row_change();

alter table public.sign_up_attribution enable row level security;
grant select on public.sign_up_attribution to authenticated, service_role;

create policy "staff with member access see the venue's sign-up codes" on public.sign_up_attribution
  for select to authenticated
  using (venue_id in (select private.venues_where('members.read')));

-- One code from the app's attribution object, or null when it is missing or malformed: a bad code
-- never stops a sign-up.
create function private.attribution_code(p_attribution jsonb, p_field text)
returns public.attribution_code
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_attribution -> p_field) = 'string' and (p_attribution ->> p_field) ~ '^[A-Za-z0-9 _.+-]{1,64}$'
    then (p_attribution ->> p_field)::public.attribution_code end;
$$;

-- The signed-in number joins: it links to the member staff registered for it, or becomes a new member
-- of the club with the name given. Returns the member. Only a number this session confirmed with a
-- code signs up, as link_my_login requires. Stopped while KYC sign-up is switched off.
create function private.sign_up(p_full_name text, p_attribution jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  code_signed_in_at timestamptz := (
    select max(to_timestamp((method ->> 'timestamp')::bigint))
    from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) method
    where method ->> 'method' = 'otp');
  verified_phone text := (select '+' || u.phone from auth.users u
                          where u.id = (select auth.uid())
                            and u.phone_confirmed_at < code_signed_in_at + interval '1 second');
  v_name text := trim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_venue_id uuid;
  v_member_id uuid;
  v_codes jsonb := coalesce(p_attribution, '{}');
begin
  if verified_phone is null then
    raise exception 'Sign in with your mobile number first' using errcode = '42501';
  end if;
  perform private.link_my_login();
  v_member_id := private.current_member_id();
  if v_member_id is not null then return v_member_id; end if;

  if (select count(*) from public.venue v where not v.is_practice) <> 1 then
    raise exception 'Sign-up needs exactly one club venue' using errcode = 'RVVEN';
  end if;
  v_venue_id := (select v.id from public.venue v where not v.is_practice);
  perform private.assert_writable(v_venue_id, 'kyc_signup', null);
  -- Staff and players are kept apart until #216 says otherwise: a cashier never becomes a player here.
  if exists (select 1 from public.staff s where s.user_id = (select auth.uid())) then
    raise exception 'Staff join as members at the front desk' using errcode = 'RVSTF';
  end if;
  -- The name as on Aadhaar, in English letters: no lookalike or invisible characters.
  if length(v_name) not between 2 and 100 or v_name !~ '^[A-Za-z][A-Za-z .''-]*$' then
    raise exception 'A full name is needed' using errcode = '22023';
  end if;

  insert into public.member (venue_id, user_id, full_name, phone)
  values (v_venue_id, (select auth.uid()), v_name, verified_phone)
  returning id into v_member_id;
  insert into public.sign_up_attribution (
    member_id, venue_id, referral_code, creator_code, utm_source, utm_medium, utm_campaign, utm_content, utm_term, first_seen_at
  ) values (
    v_member_id, v_venue_id,
    private.attribution_code(v_codes, 'referral'), private.attribution_code(v_codes, 'creator'),
    private.attribution_code(v_codes, 'utmSource'), private.attribution_code(v_codes, 'utmMedium'),
    private.attribution_code(v_codes, 'utmCampaign'), private.attribution_code(v_codes, 'utmContent'),
    private.attribution_code(v_codes, 'utmTerm'),
    case when pg_input_is_valid(v_codes ->> 'firstSeenAt', 'timestamptz') then
      case when (v_codes ->> 'firstSeenAt')::timestamptz between now() - interval '30 days' and now() + interval '1 hour'
        then least((v_codes ->> 'firstSeenAt')::timestamptz, now()) end
    end
  );
  perform private.emit(v_venue_id, 'member.signed_up',
    (select jsonb_strip_nulls(jsonb_build_object(
       'member_id', a.member_id, 'referral_code', a.referral_code, 'creator_code', a.creator_code,
       'utm_source', a.utm_source, 'utm_medium', a.utm_medium, 'utm_campaign', a.utm_campaign,
       'utm_content', a.utm_content, 'utm_term', a.utm_term))
     from public.sign_up_attribution a where a.member_id = v_member_id),
    'member.signed_up:' || v_member_id);
  return v_member_id;
end;
$$;

grant execute on function private.sign_up(text, jsonb) to authenticated;

-- As in 20261018090400_tiers_and_members.sql, except that a member of the practice venue never links:
-- practice records are staff training, sometimes made with a real number, and a real person signing
-- in must become a member of the club, not of a venue that is reset.
create or replace function private.link_my_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- When this session signed in with a code, from the token's authentication methods (amr).
  code_signed_in_at timestamptz := (
    select max(to_timestamp((method ->> 'timestamp')::bigint))
    from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) method
    where method ->> 'method' = 'otp');
  -- The amr timestamp is in whole seconds, so allow the second it falls in.
  verified_phone text := (select '+' || u.phone from auth.users u
                          where u.id = (select auth.uid())
                            and u.phone_confirmed_at < code_signed_in_at + interval '1 second');
begin
  if verified_phone is null then return; end if;
  -- One staff record per venue, so each venue's record links separately.
  update public.staff s set user_id = (select auth.uid())
  where s.user_id is null and s.phone = verified_phone
    and not exists (select 1 from public.staff o where o.venue_id = s.venue_id and o.user_id = (select auth.uid()));
  -- A login is one member, so it links the oldest unlinked club record and only if it has none.
  update public.member m set user_id = (select auth.uid())
  where m.id = (select o.id from public.member o join public.venue v on v.id = o.venue_id
                where o.user_id is null and o.phone = verified_phone and not v.is_practice
                order by o.created_at limit 1)
    and not exists (select 1 from public.member o where o.user_id = (select auth.uid()));
end;
$$;

-- Signed-in callers reach sign_up only through this invoker wrapper.
create function public.sign_up(p_full_name text, p_attribution jsonb default '{}')
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.sign_up(p_full_name, p_attribution);
$$;

grant execute on function public.sign_up(text, jsonb) to authenticated;
