-- End of down (#44): on a tablet fixed to Table 3 during Pema's down, the dealer ends the down with
-- the drop-box count; the down keeps the count, the rake and drops its hands logged, and the
-- variance; a variance beyond dealer.variance_threshold (seeded at ₹500) either way raises an alert;
-- the next dealer can sign in. Flow 4's ₹48,000 hand logs rake ₹2,400 and a ₹100 drop: ₹2,500.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.start_down() returns void language sql as $$
  insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
  select a.venue_id, a.table_id, s.id, a.device_id
  from public.tablet_assignment a
  join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id
  where a.device_id = '00000000-0000-4000-8000-00000000d001';
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
select pg_temp.start_down();

-- A down within the threshold.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select lives_ok($$ select public.log_hand(4800000, 'holdem', now(), 'end-of-down-hand-1') $$, 'flow 4: a ₹48,000 hand logs ₹2,500 of rake and drop');
select results_eq($$ select logged_paise, variance_paise from public.end_down(230000) $$,
  $$ values (250000::bigint, -20000::bigint) $$, 'a ₹2,300 drop box against ₹2,500 logged is ₹200 short');
select is_empty($$ select * from public.current_down() $$, 'the down is over, and the next dealer signs in');
select throws_ok($$ select * from public.end_down(0) $$, 'RVDWN', null, 'with no down open there is nothing to end');
reset role;
select results_eq($$ select drop_box_paise, logged_paise, variance_paise, ended_at is not null from public.dealer_down $$,
  $$ values (230000::bigint, 250000::bigint, -20000::bigint, true) $$, 'the down keeps the count, the logged amount and the variance');
select is((select count(*)::int from public.alert where kind = 'dealer.variance'), 0, '₹200 is within the ₹500 threshold: no alert');

-- A down beyond the threshold, either way.
select pg_temp.start_down();
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select lives_ok($$ select public.log_hand(4800000, 'holdem', now(), 'end-of-down-hand-2') $$, 'another ₹48,000 hand');
select results_eq($$ select variance_paise from public.end_down(320000) $$, $$ values (70000::bigint) $$,
  'a ₹3,200 drop box is ₹700 over');
reset role;
select results_eq($$ select (detail ->> 'variance_paise')::bigint, (detail ->> 'logged_paise')::bigint from public.alert where kind = 'dealer.variance' $$,
  $$ values (70000::bigint, 250000::bigint) $$, 'beyond the threshold, the floor and the owner are alerted');
select pg_temp.start_down();
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select results_eq($$ select logged_paise, variance_paise from public.end_down(0) $$, $$ values (0::bigint, 0::bigint) $$,
  'a down with no hands and an empty box balances');
reset role;

-- Counts are whole ₹50 chips, and only the tablet ends its own table's down.
select pg_temp.start_down();
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select * from public.end_down(12345) $$, '23514', null, 'a count is whole ₹50 chips');
select throws_ok($$ select * from public.end_down(-5000) $$, '23514', null, 'and never below nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select * from public.end_down(0) $$, '42501', null, 'staff do not end a down from the console this way');
reset role;
set local role anon;
select throws_ok($$ select * from public.end_down(0) $$, '42501', null, 'nor does anyone signed out');
reset role;

select * from finish();
rollback;
