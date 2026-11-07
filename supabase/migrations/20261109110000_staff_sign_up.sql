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

-- A staff member who is also a member never cuts their own call time nor lets themselves leave before it (the security
-- review of 8 Nov): as 20261101090200_table_runs_and_call_time.sql and 20261019092700_call_time_at_cash_out.sql made them,
-- with RVOWN on their own record. Adding time to their own seat stays allowed.
create or replace function private.set_seat_call_time(p_session_id uuid, p_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.has_permission(v_session.venue_id, 'waitlist.manage') then
    raise exception 'Only the floor changes a player''s call time' using errcode = '42501';
  end if;
  if v_session.ended_at is not null or v_session.call_time_completed_at is not null
     or (v_session.call_time_minutes > 0 and private.session_call_time(v_session, now()) = 0)
     or p_minutes is null or p_minutes not between 0 and 1440 then
    raise exception 'A seated player''s call time, not yet played out, is 0 to 1,440 minutes' using errcode = '22023';
  end if;
  if p_minutes < v_session.call_time_minutes and not private.has_permission(v_session.venue_id, 'call_time.override') then
    raise exception 'Only an admin cuts a player''s call time' using errcode = '42501';
  end if;
  if p_minutes < v_session.call_time_minutes and private.is_own_cage_record(v_session.member_id) then
    raise exception 'Staff never cut their own call time' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(v_session.venue_id, null, v_session.member_id);
  update public.seat_session
  set call_time_minutes = p_minutes
  where id = v_session.id;
end;
$$;

create or replace function private.let_leave_early(p_venue_id uuid, p_member_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owed record;
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'call_time.override') then
    raise exception 'Only an admin lets a player leave before call time' using errcode = '42501';
  end if;
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  if private.is_own_cage_record(p_member_id) then
    raise exception 'Staff never let themselves leave before call time' using errcode = 'RVOWN';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Say why, in 3 to 500 characters' using errcode = '22023';
  end if;
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) = 0 then
    raise exception 'No call time owed: nothing to let go early' using errcode = 'RVCTD';
  end if;
  insert into public.early_departure (venue_id, member_id, visit_id, session_id, shortfall_seconds, reason, overridden_by_staff_id)
  values (p_venue_id, p_member_id, private.current_visit(p_member_id), v_owed.o_session_id, v_owed.o_seconds, btrim(p_reason),
          private.current_staff_id(p_venue_id))
  on conflict (session_id) do nothing
  returning id into v_id;
  return coalesce(v_id, (select e.id from public.early_departure e where e.session_id = v_owed.o_session_id));
end;
$$;
