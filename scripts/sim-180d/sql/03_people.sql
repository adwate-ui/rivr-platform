-- 180-day simulation: a member's way in. SIMULATION ONLY.
-- Sign-up, the selfie in the app, the desk's check on the first visit, and the door (kiosk or desk).

create function sim.persona_row(p_member uuid) returns sim.persona language sql stable as $$ select * from sim.persona where member_id = p_member $$;

-- A referrer's code: an earlier member's, picked by the joiner's number.
create function sim.referral_of(p_seq int) returns text language sql stable as $$
  select m.referral_code from public.member m join sim.persona p on p.member_id = m.id
  where m.referral_code is not null and not p.erased order by p.number offset (p_seq % 50) limit 1 $$;

create function sim.attribution(p_source text, p_seq int) returns jsonb language sql stable as $$
  select case p_source
    when 'creator_code' then jsonb_build_object('creator', 'ARJUN10', 'utmSource', 'instagram')
    when 'referral' then coalesce(jsonb_build_object('referral', sim.referral_of(p_seq)), '{}')
    when 'website' then '{"utmSource": "website"}'::jsonb
    else '{}'::jsonb end $$;

-- A new member signs up from the app as Auth leaves them: a confirmed phone and a code sign-in (amr otp).
create function sim.sign_up(p_n int, p_idx int, p_persona text, p_source text) returns uuid language plpgsql as $$
declare
  v_seq int := p_n * 100 + p_idx;
  v_user uuid := sim.uid('member:' || v_seq);
  v_phone text := sim.phone(v_seq);
  v_name text := sim.name(v_seq);
  v_member uuid;
  r jsonb;
begin
  perform sim.auth_user(v_user, v_phone);
  r := sim.try_claims(sim.claims(v_user), 'member.sign_up',
    format('select public.sign_up(%L, %L::jsonb)', v_name, sim.attribution(p_source, v_seq)));
  if not sim.ok(r) then return null; end if;
  v_member := sim.val(r)::uuid;
  perform sim.try(v_user, 'member.sign_up_answers',
    'select public.set_my_sign_up_answers(''Gurugram'', ''salaried'', array[''weekday_evenings'', ''weekends''], array[''poker''])');
  insert into sim.persona (member_id, user_id, phone, number, full_name, persona, source, joined_night)
  select m.id, v_user, m.phone, m.member_number, m.full_name, p_persona, p_source, p_n from public.member m where m.id = v_member;
  return v_member;
end $$;

-- The selfie in the app, while identity is checked at the club: the kyc function stores the photo, then lets them in.
create function sim.selfie(p_member uuid) returns boolean language plpgsql as $$
declare
  p sim.persona := sim.persona_row(p_member);
  r jsonb;
begin
  perform sim.try(p.user_id, 'kyc.begin_photo', 'select public.begin_sign_up_photo()');
  insert into storage.objects (bucket_id, name, created_at, updated_at)
  values ('kyc', sim.venue() || '/' || p_member || '/photo.jpg', sim_clock.now(), sim_clock.now())
  on conflict do nothing;
  r := sim.try(p.user_id, 'kyc.take_at_the_club', 'select public.take_kyc_at_the_club()');
  update sim.persona set selfie_taken = sim.ok(r) and coalesce(sim.val(r)::boolean, false) where member_id = p_member;
  return sim.ok(r) and coalesce(sim.val(r)::boolean, false);
end $$;

-- Details that look real and never clash: PAN AAA P A 9999 Z from the member number, a date of birth 20 to 45 years back.
create function sim.pan(p_number bigint) returns text language sql immutable as $$
  select chr(65 + (p_number / 676 % 26)::int) || chr(65 + (p_number / 26 % 26)::int) || chr(65 + (p_number % 26)::int)
         || 'P' || chr(65 + (p_number / 17 % 26)::int) || lpad((p_number % 10000)::text, 4, '0') || 'Z' $$;
create function sim.dob(p_number bigint) returns date language sql immutable as $$
  select date '1981-01-01' + ((p_number * 37) % 8000)::int $$;

-- The desk checks the member in person on their first visit: the photo first, then Aadhaar's last four and PAN.
create function sim.desk_check(p_member uuid) returns boolean language plpgsql as $$
declare
  p sim.persona := sim.persona_row(p_member);
  v_desk uuid := sim.who('desk');
  v_path text;
  r jsonb;
begin
  r := sim.try(v_desk, 'kyc.authorize_in_person', format('select public.authorize_in_person_kyc(%L)', p_member));
  if not sim.ok(r) then return false; end if;
  v_path := sim.val(r);
  insert into storage.objects (bucket_id, name, created_at, updated_at) values ('kyc', v_path, sim_clock.now(), sim_clock.now());
  r := sim.try(v_desk, 'kyc.in_person', format('select public.check_kyc_in_person(%L, %L, %L::date, %L, %L, true)',
    p_member, v_path, sim.dob(p.number), lpad(((p.number * 7919) % 10000)::text, 4, '0'), sim.pan(p.number)));
  update sim.persona set verified = sim.ok(r) where member_id = p_member and sim.ok(r);
  return sim.ok(r);
end $$;

-- The card's QR code at the door kiosk: the code the member's app shows now, scanned by the kiosk's own login.
create function sim.kiosk_scan(p_member uuid) returns text language plpgsql as $$
declare
  p sim.persona := sim.persona_row(p_member);
  r jsonb;
begin
  r := sim.try(p.user_id, 'card.show', 'select code from public.my_membership_card()');
  if not sim.ok(r) then return null; end if;
  r := sim.try((select login from sim.device where key = 'door'), 'door.scan',
    format('select action from public.door_scan(%L)', sim.val(r)));
  return case when sim.ok(r) then sim.val(r) end;
end $$;

-- The desk checks a member in by phone from the console's Door screen.
create function sim.desk_check_in(p_member uuid) returns boolean language sql as $$
  select sim.ok(sim.try(sim.who('desk'), 'door.check_in_by_phone',
    format('select public.check_in_by_phone(%L, %L)', sim.venue(), (sim.persona_row(p_member)).phone))) $$;
