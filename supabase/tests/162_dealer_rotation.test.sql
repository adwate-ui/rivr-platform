-- The dealers' board (#124; decision 0252): Manoj has dealt Table 1 for 40 minutes; Bhavna dealt Table 5 for an hour,
-- three hands, and rests since 20 minutes; Pema deals Table 3 (the seed's). 103 Aditya is an admin (floor.manage);
-- 106 Pema a dealer; 213 Mihir a member; Elsewhere's admin runs nothing at the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000998', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');

create temporary table fixture on commit drop as
  select (select id from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and full_name = 'Manoj Thapa') as manoj,
         (select id from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and full_name = 'Bhavna Rawat') as bhavna,
         (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 1') as table_1,
         (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5') as table_5,
         '00000000-0000-4000-8000-000000005d21'::uuid as tablet;
insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at)
select '00000000-0000-4000-8000-000000000001', f.table_1, f.manoj, f.tablet, now() - interval '40 minutes' from fixture f;
create temporary table bhavna_down on commit drop as
  with made as (insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at, ended_at)
                select '00000000-0000-4000-8000-000000000001', f.table_5, f.bhavna, f.tablet, now() - interval '80 minutes', now() - interval '20 minutes'
                from fixture f returning id)
  select id from made;
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied, played_at, idempotency_key)
select '00000000-0000-4000-8000-000000000001', f.table_5, d.id, f.bhavna, f.tablet, 'holdem', 100000, 5000, 0, false, now() - make_interval(mins => m), 'test-dealer-hand-' || m
from fixture f cross join bhavna_down d cross join unnest(array[70, 50, 30]) m;
insert into public.down_count (down_id, venue_id, drop_box_paise, logged_paise, variance_paise)
select d.id, '00000000-0000-4000-8000-000000000001', 10000, 15000, -5000 from bhavna_down d;

-- Four more dealers: Ravi, five minutes at Table 4, not yet due; Sunil, whose last down ended 13 hours ago; Neha, on a
-- shift since an hour ago with no down yet; Om, on a shift marked absent.
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.phone, now(), now()
from (values ('00000000-0000-4000-8000-0000000d9241'::uuid, '919000009241'), ('00000000-0000-4000-8000-0000000d9242', '919000009242'),
             ('00000000-0000-4000-8000-0000000d9243', '919000009243'), ('00000000-0000-4000-8000-0000000d9244', '919000009244')) u (id, phone);
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d9241', 'Ravi Test', 'Dealer', 'dealer'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d9242', 'Sunil Test', 'Dealer', 'dealer'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d9243', 'Neha Test', 'Dealer', 'dealer'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d9244', 'Om Test', 'Dealer', 'dealer');
create function pg_temp.staff_named(p_name text) returns uuid language sql as $$
  select id from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and full_name = p_name;
$$;
insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-000000000001', (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 4'),
       pg_temp.staff_named(d.name), '00000000-0000-4000-8000-000000005d21', now() - d.began, now() - d.ended
from (values ('Ravi Test', interval '5 minutes', null::interval), ('Sunil Test', interval '14 hours', interval '13 hours')) d (name, began, ended);
insert into public.staff_shift (venue_id, staff_id, club_day, starts_at, ends_at, job_title)
select '00000000-0000-4000-8000-000000000001', pg_temp.staff_named(n), (now() at time zone 'Asia/Kolkata' - interval '6 hours')::date,
       now() - interval '1 hour', now() + interval '7 hours', 'Dealer'
from unnest(array['Neha Test', 'Om Test']) n;
insert into public.staff_attendance (venue_id, shift_id, status)
select '00000000-0000-4000-8000-000000000001', h.id, 'absent' from public.staff_shift h where h.staff_id = pg_temp.staff_named('Om Test');

-- The board.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select state, dealer_name, table_name, minutes, is_due from public.dealer_rotation('00000000-0000-4000-8000-000000000001')
                     where dealer_name in ('Manoj Thapa', 'Bhavna Rawat') $$,
  $$ values ('dealing'::text, 'Manoj Thapa'::text, 'Table 1'::text, 40, true), ('resting', 'Bhavna Rawat', null, 20, false) $$,
  'Manoj, 40 minutes at Table 1, is due for rotation at the 30 minutes not set otherwise; Bhavna has rested 20 minutes');
select ok(exists (select 1 from public.dealer_rotation('00000000-0000-4000-8000-000000000001')
                  where state = 'dealing' and dealer_name = 'Pema Lepcha' and table_name = 'Table 3'), 'Pema deals Table 3');
select is((select state from public.dealer_rotation('00000000-0000-4000-8000-000000000001') limit 1), 'dealing', 'the dealing come first');
select results_eq($$ select dealer_name, is_due from public.dealer_rotation('00000000-0000-4000-8000-000000000001')
                     where state = 'dealing' and dealer_name in ('Manoj Thapa', 'Ravi Test') $$,
  $$ values ('Manoj Thapa'::text, true), ('Ravi Test', false) $$, 'the due before the rest, though Ravi came to his table later');
select results_eq($$ select dealer_name, minutes from public.dealer_rotation('00000000-0000-4000-8000-000000000001')
                     where state = 'resting' and dealer_name in ('Neha Test', 'Sunil Test', 'Om Test') $$,
  $$ values ('Neha Test'::text, 60) $$,
  'Neha, on her shift an hour, rests; Sunil, gone 13 hours, and Om, marked absent, are not on the board');
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'dealer.rotation_minutes', '', '{"minutes": 45}', now() - interval '1 minute', 'Test');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'dealer.rotation_minutes', '', '{"minutes": 5}', now(), 'Test') $$,
  null, null, 'a rotation under ten minutes is refused');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select is_due from public.dealer_rotation('00000000-0000-4000-8000-000000000001') where dealer_name = 'Manoj Thapa'), false,
  'at 45 minutes, Manoj is not yet due');

-- Each dealer's time, hands, hands per hour, rake and variance over a period.
select results_eq($$ select dealer_name, downs, dealt_seconds, hands, hands_per_hour, rake_paise, variance_paise, counted_downs
                     from public.dealer_nights('00000000-0000-4000-8000-000000000001', now() - interval '1 day', now() + interval '1 minute')
                     where dealer_name in ('Manoj Thapa', 'Bhavna Rawat') $$,
  $$ values ('Bhavna Rawat'::text, 1, 3600, 3, 3.0::numeric, 15000::bigint, -5000::bigint, 1), ('Manoj Thapa', 1, 2400, 0, 0.0, 0, null, 0) $$,
  'Bhavna dealt an hour, three hands, ₹150 rake, ₹50 short in the drop box; Manoj 40 minutes so far, nothing counted yet');
select results_eq($$ select dealer_name, dealt_seconds, variance_paise, counted_downs
                     from public.dealer_nights('00000000-0000-4000-8000-000000000001', now() - interval '80 minutes', now() - interval '30 minutes')
                     where dealer_name = 'Bhavna Rawat' $$,
  $$ values ('Bhavna Rawat'::text, 3000, null::bigint, 0) $$, 'a down''s variance counts in the period it ended, so never twice');
select results_eq($$ select dealer_name, dealt_seconds, hands, hands_per_hour
                     from public.dealer_nights('00000000-0000-4000-8000-000000000001', now() - interval '50 minutes', now())
                     where dealer_name in ('Manoj Thapa', 'Bhavna Rawat') $$,
  $$ values ('Bhavna Rawat'::text, 1800, 2, 4.0::numeric), ('Manoj Thapa', 2400, 0, 0.0) $$,
  'a period counts only the time and hands inside it');

-- Who sees it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.dealer_rotation('00000000-0000-4000-8000-000000000001') $$, 'a dealer sees no board');
select is_empty($$ select 1 from public.dealer_nights('00000000-0000-4000-8000-000000000001', now() - interval '1 day', now()) $$,
  'nor anyone''s hands');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select 1 from public.dealer_nights('00000000-0000-4000-8000-000000000001', now() - interval '1 day', now()) $$,
  'a cashier, who reads the ledger but does not run the floor, sees no one''s hours');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select 1 from public.dealer_rotation('00000000-0000-4000-8000-000000000001') $$, 'nor does a member');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select 1 from public.dealer_rotation('00000000-0000-4000-8000-000000000001') $$, 'nor another venue''s admin');
select is_empty($$ select 1 from public.dealer_nights('00000000-0000-4000-8000-000000000001', now() - interval '1 day', now()) $$,
  'who sees no hours either');
reset role;
select ok(not has_function_privilege('anon', 'public.dealer_rotation(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.dealer_nights(uuid, timestamptz, timestamptz)', 'execute')
          and not has_function_privilege('anon', 'private.dealer_rotation(uuid)', 'execute')
          and not has_function_privilege('anon', 'private.dealer_nights(uuid, timestamptz, timestamptz)', 'execute'),
  'no one signed out reads the board');

select * from finish();
rollback;
