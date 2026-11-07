-- Staff sign up as members like anyone else (the owner, 8 Nov), reversing #216's separation: a staff login whose number
-- has no member becomes one, on the same login, so the console and the player app are one person's. A cashier never
-- serves their own record all the same (private.is_own_cage_record), and staff never redeem their own bonus chips.
-- As 20261018091800_sign_up.sql made it otherwise.

-- The signed-in number joins: it links to the member staff registered for it, or becomes a new member of the club with the
-- name given. Returns the member. Only a number this session confirmed with a code signs up, as link_my_login requires.
-- Stopped while KYC sign-up is switched off.
create or replace function private.sign_up(p_full_name text, p_attribution jsonb default '{}')
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
