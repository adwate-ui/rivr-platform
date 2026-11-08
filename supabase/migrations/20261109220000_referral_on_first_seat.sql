-- A referral completes on the new member's first seat (the owner, 9 Nov; decision 0509). It completed on their first
-- buy-in, which no live screen records since the Cage was hidden (29 Oct, decision 0284), so none ever did. Now the first
-- seat session of a member who signed up with another member's code completes it, however the floor seats them (by
-- number, from a list, or a call), once that seat is past its two minutes of Undo (decision 0480): a seat taken by
-- mistake and undone pays nobody. A sweep each minute does it, for seats begun in the last day, and waits while the venue
-- is frozen or promotions are stopped. Members who already played with a code are paid once, as this migration runs (the
-- owner, 9 Nov). The referral promotion credits each side as before. A buy-in completes nothing. Sign-up refuses a
-- referral code that names no member of the club, so a player can put a typo right (the owner, 9 Nov).
-- As 20261028391800_random_referral_codes_and_monthly_budgets.sql made it otherwise: one referral to a new member; never
-- their own code, an erased or self-excluded member's, one whose tier has no referrals, or the practice venue's.

-- As 20261028390800_referral_programme.sql made it, without the referral.
create or replace function private.buy_in_promotions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return null;
  end if;
  perform private.evaluate_promotions(new.venue_id, 'buy_in', jsonb_build_object(
    'member_id', new.member_id, 'key', 'buy_in:' || new.id, 'amount_paise', new.amount_paise, 'method', new.method,
    'table_id', (select s.table_id from public.seat_session s where s.id = new.session_id)));
  return null;
end;
$$;

drop function private.complete_referral(uuid, uuid, uuid);

-- Completes the member's referral for `p_session_id`, their first seat: the code they signed up with names a member who
-- may refer; each side's referral promotion runs, and `referral.completed` goes out. Nothing for a seat after an earlier one;
-- a later seat never blocks it (a member re-seated before the sweep is still paid for the first).
create function private.complete_referral(p_venue_id uuid, p_member_id uuid, p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer public.member;
  v_code text;
  v_id uuid;
begin
  if (select v.is_practice from public.venue v where v.id = p_venue_id)
     or exists (select 1 from public.seat_session s where s.member_id = p_member_id and s.id <> p_session_id
                and s.started_at < (select f.started_at from public.seat_session f where f.id = p_session_id)) then
    return;
  end if;
  select upper(btrim(a.referral_code)) into v_code from public.sign_up_attribution a where a.member_id = p_member_id;
  select m.* into v_referrer from public.member m
  where m.venue_id = p_venue_id and m.id <> p_member_id and m.erased_at is null and m.referral_code = v_code
    and private.has_feature(m.id, 'referral.share_cards')
    and not exists (select 1 from public.self_exclusion x where x.member_id = m.id and x.starts_at <= now() and x.ends_at > now());
  if v_referrer.id is null then
    return;
  end if;
  insert into public.referral (venue_id, member_id, referrer_member_id, code)
  values (p_venue_id, p_member_id, v_referrer.id, v_code)
  on conflict (member_id) do nothing
  returning id into v_id;
  if v_id is null then
    return;
  end if;
  perform private.evaluate_promotions(p_venue_id, 'referral', jsonb_build_object('member_id', p_member_id, 'key', 'referral:' || v_id || ':joined'));
  perform private.evaluate_promotions(p_venue_id, 'referral', jsonb_build_object('member_id', v_referrer.id, 'key', 'referral:' || v_id || ':referred'));
  perform private.emit(p_venue_id, 'referral.completed',
                       jsonb_build_object('referral_id', v_id, 'member_id', p_member_id, 'referrer_member_id', v_referrer.id),
                       'referral.completed:' || v_id);
end;
$$;

revoke execute on function private.complete_referral(uuid, uuid, uuid) from public, anon, authenticated;

-- Each minute, every member who signed up with a code and has no referral yet, whose first seat since `p_from` is past its
-- Undo, completes it (complete_referral pays only a first seat); how many were completed. A member is passed over while
-- the venue is frozen or promotions are stopped, and tried again the next minute. One that cannot be completed never stops
-- the others; it is logged. Nothing at a venue being purged.
create function private.sweep_referrals(p_from timestamptz default now() - interval '1 day')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seat record;
  v_done integer := 0;
begin
  for v_seat in
    select distinct on (s.member_id) s.venue_id, s.member_id, s.id
    from public.seat_session s
    join public.sign_up_attribution a on a.member_id = s.member_id and a.referral_code is not null
    where s.started_at > p_from and not private.is_undoable(s.started_at)
      and not exists (select 1 from public.referral r where r.member_id = s.member_id)
    order by s.member_id, s.started_at, s.id
  loop
    -- purging() is null when no purge is set: only a purge in hand skips the venue.
    continue when private.purging(v_seat.venue_id) is true;
    begin
      perform private.assert_writable(v_seat.venue_id, 'promotions', v_seat.member_id);
    exception when others then
      continue;
    end;
    begin
      perform private.complete_referral(v_seat.venue_id, v_seat.member_id, v_seat.id);
      v_done := v_done + (select count(*)::integer from public.referral r where r.member_id = v_seat.member_id);
    exception when others then
      raise warning 'referrals: member % not completed: %', v_seat.member_id, sqlerrm;
    end;
  end loop;
  return v_done;
end;
$$;

revoke execute on function private.sweep_referrals(timestamptz) from public, anon, authenticated;

select cron.schedule('referrals', '* * * * *', 'select private.sweep_referrals()');

-- Members who already played with a code are paid once, now (the owner, 9 Nov: "Pay them once"); the deploy's log says how
-- many.
do $$
begin
  raise notice 'referrals completed for members seated before this rule: %', private.sweep_referrals('-infinity');
end;
$$;

-- As 20261109110000_staff_sign_up.sql made it, refusing a referral code that names no member of the club.
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
  -- A friend's referral code names a member of the club (the owner, 9 Nov): one that names nobody is refused, so the player
  -- can put it right or leave it empty.
  if private.attribution_code(v_codes, 'referral') is not null
     and not exists (select 1 from public.member m where m.venue_id = v_venue_id and m.erased_at is null
                     and m.referral_code = upper(btrim(private.attribution_code(v_codes, 'referral')))) then
    raise exception 'No member has that referral code' using errcode = 'RVREF';
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
