-- 180-day simulation: the club on night 0. SIMULATION ONLY.
-- The calendar and the joiners come from TypeScript (src/calendar, src/people): bin/run.ts fills sim.night and sim.joiner.

create table sim.night (n int primary key, date date not null, expected int not null, peak boolean not null, events text[] not null);
create table sim.joiner (n int not null, idx int not null, persona text not null, source text not null, primary key (n, idx));

-- The cast: who acts in each staff role. Seeded people, plus two floor staff the super admin adds on night 0.
create table sim.staff (key text primary key, role text not null, user_id uuid not null, staff_id uuid, full_name text);
create function sim.who(p_key text) returns uuid language sql stable as $$ select user_id from sim.staff where key = p_key $$;

-- Every member the simulation plays, with how they play and where their identity check stands.
create table sim.persona (
  member_id uuid primary key, user_id uuid not null, phone text not null, number bigint not null, full_name text not null,
  persona text not null, source text not null, joined_night int not null default 0, verified boolean not null default false,
  selfie_taken boolean not null default false, hides_name boolean not null default false, excluded_until date,
  erased boolean not null default false, visits int not null default 0);
create table sim.tbl (table_id uuid primary key, name text not null, type_code text not null, seats int not null, device_login uuid);
create table sim.device (key text primary key, device_id uuid not null, login uuid not null);
create table sim.promo (key text primary key, version_id uuid);
grant all on all tables in schema sim to public;

-- A valid Indian mobile for the n-th made-up person: +91 99900 xxxxx, never a seeded number.
create function sim.phone(p_seq int) returns text language sql immutable as $$ select '+9199900' || lpad(p_seq::text, 5, '0') $$;

-- Names without digits, as sign-up requires.
create function sim.name(p_seq int) returns text language sql immutable as $$
  select (array['Aarav','Diya','Kabir','Anaya','Rohan','Isha','Arjun','Meher','Vivaan','Tara','Neil','Riya','Aditi','Karan',
                'Sana','Varun','Nisha','Dev','Pooja','Rahul','Ira','Kunal','Leela','Om'])[1 + p_seq % 24] || ' ' ||
         (array['Sharma','Mehta','Iyer','Kapoor','Rao','Singh','Bose','Nair','Gupta','Khanna','Das','Malik','Sethi','Pillai',
                'Joshi','Bhatt','Reddy','Chawla','Verma','Saxena'])[1 + (p_seq / 24) % 20] $$;

-- A made-up auth user, as Auth makes one after a phone sign-in. Auth keeps phones without the plus.
create function sim.auth_user(p_id uuid, p_phone text) returns uuid language sql as $$
  -- Auth reads its token columns as text: empty, never NULL, or a sign-in in the browser fails.
  insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at, confirmation_token, recovery_token,
                          email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', ltrim(p_phone, '+'),
          sim_clock.now() - interval '2 seconds', sim_clock.now(), sim_clock.now(), '', '', '', '', '', '', '', '')
  on conflict (id) do nothing
  returning id $$;

create function sim.seed_staff(p_key text, p_role text, p_phone text) returns void language sql as $$
  insert into sim.staff (key, role, user_id, staff_id, full_name)
  select p_key, p_role, s.user_id, s.id, s.full_name from public.staff s
  where s.venue_id = sim.venue() and s.phone = p_phone and s.role::text = p_role $$;

-- A super admin adds a member of staff through the staff table (its RLS), and the person links their login by phone.
create function sim.add_staff(p_key text, p_role text, p_name text, p_seq int) returns void language plpgsql as $$
declare
  v_user uuid := sim.uid('staff:' || p_key);
  v_phone text := '+919992' || lpad(p_seq::text, 6, '0');
  r jsonb;
begin
  perform sim.auth_user(v_user, v_phone);
  r := sim.try(sim.who('super1'), 'staff.add', format(
    'insert into public.staff (venue_id, full_name, job_title, role, phone) values (%L, %L, %L, %L, %L) returning id',
    sim.venue(), p_name, initcap(replace(p_role, '_', ' ')), p_role, v_phone));
  perform sim.try(v_user, 'staff.link_login', 'select public.link_my_login()');
  insert into sim.staff (key, role, user_id, staff_id, full_name) values (p_key, p_role, v_user, (sim.val(r))::uuid, p_name);
end $$;

-- A setting, as a super admin writes it (control settings need a reason and alert the owner).
create function sim.set_setting(p_key text, p_value jsonb, p_reason text) returns jsonb language sql as $$
  select sim.try(sim.who('super1'), 'setting.' || p_key, format(
    'insert into public.setting (venue_id, key, value, effective_from, reason) values (%L, %L, %L::jsonb, sim_clock.now(), %L) returning id',
    sim.venue(), p_key, p_value, p_reason)) $$;

-- A promotion through the console's whole path: marketing drafts, simulates and submits; a super admin approves.
create function sim.promotion(p_key text, p_name text, p_reward jsonb, p_limits jsonb) returns void language plpgsql as $$
declare
  v_terms jsonb := jsonb_build_object(
    'name', p_name, 'reward', p_reward,
    'eligibility', '{"stakes": "all", "tiers": "all", "audience": "everyone"}'::jsonb,
    'schedule', '{"days": [1,2,3,4,5,6,7], "from": "06:00", "to": "06:00", "startsOn": "2026-11-15", "timezone": "Asia/Kolkata"}'::jsonb,
    'limits', p_limits, 'channels', '{"playerApp": true, "tv": true, "website": true, "whatsapp": true}'::jsonb,
    'rulesText', jsonb_build_array(p_name || ' for members of RIVR.'));
  v_version uuid;
  m uuid := sim.who('marketing');
begin
  v_version := sim.val(sim.try(m, 'promotion.draft', format('select public.save_promotion_draft(%L, %L::jsonb)', sim.venue(),
    jsonb_build_object('terms', v_terms, 'detail', p_name, 'runs', 'Every day', 'request_id', gen_random_uuid()))))::uuid;
  perform sim.try(m, 'promotion.simulate', format('select public.record_promotion_simulation(%L, %L::jsonb, %L::jsonb)', v_version,
    '{"events": 0, "membersQualified": 0, "timesGiven": 0, "points": 0, "chips": 0, "spins": 0, "perks": 0, "isBudgetReached": false}', v_terms));
  perform sim.try(m, 'promotion.submit', format('select public.submit_promotion_version(%L)', v_version));
  perform sim.try(sim.who('super1'), 'promotion.approve', format('select public.approve_promotion_version(%L)', v_version));
  insert into sim.promo values (p_key, v_version);
end $$;

-- How a seeded member plays, from their number: the same shares as src/people/growth.ts.
create function sim.persona_of(p_number bigint) returns text language sql immutable as $$
  select case when p_number % 100 < 15 then 'grinder' when p_number % 100 < 45 then 'regular' when p_number % 100 < 80 then 'casual'
              when p_number % 100 < 90 then 'walk_in' when p_number % 100 < 95 then 'event' else 'lapsed' end $$;

create function sim.cast_and_devices() returns void language plpgsql as $$
begin
  perform sim.seed_staff('super1', 'super_admin', '+919000000101');
  perform sim.seed_staff('super2', 'super_admin', '+919000000102');
  perform sim.seed_staff('admin', 'admin', '+919000000103');
  perform sim.seed_staff('cashier', 'cashier', '+919000000104');
  perform sim.seed_staff('dealer1', 'dealer', '+919000000106');
  perform sim.seed_staff('marketing', 'marketing', '+919000000107');
  perform sim.seed_staff('host', 'host', '+919000000108');
  perform sim.seed_staff('investor', 'owner_view', '+919000000109');
  perform sim.seed_staff('desk', 'host', '+919000000124');
  perform sim.seed_staff('service', 'service', '+919000000790');
  perform sim.add_staff('floor1', 'floor', 'Rohan Mehta', 1);
  perform sim.add_staff('floor2', 'floor', 'Anjali Desai', 2);
  insert into sim.tbl (table_id, name, type_code, seats, device_login)
  select t.id, t.name, y.code, t.seats, d.auth_user_id from public.game_table t join public.table_type y on y.id = t.table_type_id
  left join public.device d on d.venue_id = t.venue_id and d.kind = 'dealer_tablet' and d.revoked_at is null
    and exists (select 1 from public.tablet_assignment a where a.device_id = d.id and a.table_id = t.id)
  where t.venue_id = sim.venue() and t.active and t.deleted_at is null;
  -- The door kiosk, as pairing leaves it: a device of kind door with its own login (the census pairs one through the UI).
  perform sim.auth_user(sim.uid('device:door'), '+919991000001');
  insert into public.device (venue_id, kind, name, auth_user_id, enrolled_at)
  values (sim.venue(), 'door', 'Door kiosk', sim.uid('device:door'), sim_clock.now());
  insert into sim.device select 'door', id, auth_user_id from public.device where auth_user_id = sim.uid('device:door');
  -- A lounge TV, its rotation set by the admin to every board that names members (the hidden-name check reads them).
  perform sim.auth_user(sim.uid('device:tv'), '+919991000002');
  insert into public.device (venue_id, kind, name, auth_user_id, enrolled_at)
  values (sim.venue(), 'tv', 'Lounge TV', sim.uid('device:tv'), sim_clock.now());
  insert into sim.device select 'tv', id, auth_user_id from public.device where auth_user_id = sim.uid('device:tv');
  insert into public.tv_screen (device_id, venue_id, mode, rotation) select device_id, sim.venue(), 'waitlist', '{}' from sim.device where key = 'tv';
  perform sim.try(sim.who('admin'), 'tv.rotation', format(
    'select public.set_tv_rotation(p_device_id => %L, p_rotation => array[''call_time'', ''rewards'', ''spin_wheel'']::public.tv_mode[])',
    (select device_id from sim.device where key = 'tv')));
  -- A super admin, not an admin: can_grant_role lets an admin manage only roles whose every permission they hold, and
  -- a dealer holds hands.log, which an admin does not. (A lead for the review: may an admin set a dealer's PIN?)
  perform sim.try(sim.who('admin'), 'dealer.pin_by_admin', format('select public.set_dealer_pin(%L, %L)', (select staff_id from sim.staff where key = 'dealer1'), '2741'), true);
  perform sim.try(sim.who('super1'), 'dealer.pin', format('select public.set_dealer_pin(%L, %L)', (select staff_id from sim.staff where key = 'dealer1'), '2741'));
end $$;

create function sim.club_settings() returns void language plpgsql as $$
begin
  perform sim.set_setting('kyc.at_the_club', '{"enabled": true}', 'Cashfree is not live: identity is checked at the club');
  perform sim.set_setting('points.daily_staff_cap', '{"points": 10000}', 'The owner''s cap of 3 Nov');
  perform sim.try(sim.who('super1'), 'venue.alert_number',
    format('update public.venue_config set alert_whatsapp = %L where venue_id = %L returning venue_id', '+919999000999', sim.venue()));
  -- No creator is seeded and the Creators screen is hidden (decision 0284), so night 0 adds one directly to give the code a target.
  insert into public.creator (venue_id, name, code, commission_basis, commission_paise) values (sim.venue(), 'Arjun Plays', 'ARJUN10', 'kyc', 0);
  perform sim.promotion('signup', 'Welcome chips', '{"kind": "bonus_chips", "chips": 500, "on": "signup"}', '{"perMember": "once"}');
  perform sim.promotion('hours', 'Play-time bonus',
    '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 120, "chips": 200}, {"afterMinutes": 240, "chips": 500}]}',
    '{"perMember": "per_visit"}');
  perform sim.promotion('spin', 'A spin after three hours', '{"kind": "free_spin", "spins": 1, "afterMinutes": 180}', '{"perMember": "per_day"}');
end $$;

-- The seeded members at the live venue become personas; sign-ups bring the club to 150 on launch day.
create function sim.members_on_launch() returns void language plpgsql as $$
declare
  v_missing int;
begin
  insert into sim.persona (member_id, user_id, phone, number, full_name, persona, source, verified)
  select m.id, m.user_id, m.phone, m.member_number, m.full_name, sim.persona_of(m.member_number), 'seed',
         exists (select 1 from public.kyc_record k where k.member_id = m.id and k.status = 'verified')
  from public.member m where m.venue_id = sim.venue() and m.erased_at is null and m.user_id is not null;
  v_missing := 150 - (select count(*) from sim.persona);
  for i in 1..greatest(v_missing, 0) loop
    perform sim.sign_up(0, i, sim.persona_of(i), 'website');
  end loop;
end $$;

-- The local seed plays a "tonight" at the live venue (waiting places, seats and visits stamped minutes before now).
-- Production starts clean, so night 0 closes it as the club would: places left, seats ended, members checked out.
create function sim.close_rehearsal() returns void language plpgsql as $$
declare
  w record;
begin
  for w in select e.id, m.user_id from public.waitlist_entry e join public.member m on m.id = e.member_id
           where e.venue_id = sim.venue() and e.status = 'waiting' loop
    perform sim.try(w.user_id, 'day0.leave_rehearsal_place', format('select public.leave_waitlist(%L)', w.id));
  end loop;
  for w in select s.id from public.seat_session s where s.venue_id = sim.venue() and s.ended_at is null loop
    perform sim.try(sim.floor(), 'day0.end_rehearsal_seat', format('select public.end_seat(p_session_id => %L, p_reason => %L)', w.id, 'table_closed'));
  end loop;
  for w in select v.member_id from public.visit v join sim.persona p using (member_id) where v.venue_id = sim.venue() and v.closed_at is null loop
    perform sim.check_out(w.member_id);
  end loop;
  perform sim.event('rehearsal_closed', jsonb_build_object(
    'places_left', (select count(*) from public.waitlist_entry where venue_id = sim.venue() and status = 'waiting'),
    'seats_open', (select count(*) from public.seat_session where venue_id = sim.venue() and ended_at is null),
    'visits_open', (select count(*) from public.visit where venue_id = sim.venue() and closed_at is null)));
end $$;

create function sim.day0() returns void language plpgsql as $$
begin
  perform sim.cast_and_devices();
  perform sim.club_settings();
  perform sim.members_on_launch();
  perform sim.close_rehearsal();
  perform sim.spin_prizes();
end $$;
