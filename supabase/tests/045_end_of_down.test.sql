-- End of down (#44): on a tablet fixed to Table 3 during Pema's down, the dealer ends the down with
-- the drop-box count; the down's count keeps it, the rake and drops its hands logged, and the
-- variance; a variance beyond dealer.variance_threshold (seeded at ₹500) either way raises an alert,
-- and with no threshold set any variance does; a down with hands that closes without a count raises
-- one too; counts are seen only by staff who read the ledger; the next dealer can sign in. Flow 4's
-- ₹48,000 hand logs rake ₹2,400 and a ₹100 drop: ₹2,500.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor (56_floor.sql) is set aside, so this test builds its own: the seeded tablets leave
-- their tables, which ends Pema's down at Table 3 (private.end_tablet_downs).
delete from public.tablet_assignment;

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
select results_eq($$ select c.drop_box_paise, c.logged_paise, c.variance_paise, d.ended_at is not null
                     from public.down_count c join public.dealer_down d on d.id = c.down_id
                     where d.device_id = '00000000-0000-4000-8000-00000000d001' $$,
  $$ values (230000::bigint, 250000::bigint, -20000::bigint, true) $$, 'the down''s count keeps the box, the logged amount and the variance');
select is((select count(*)::int from public.alert where kind = 'dealer.variance'), 0, '₹200 is within the ₹500 threshold: no alert');
select throws_ok($$ update public.down_count set drop_box_paise = 250000 $$, null, null, 'a count is never changed');

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

-- With no threshold set, any variance raises an alert: the safest reading.
delete from public.setting where key = 'dealer.variance_threshold';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select results_eq($$ select variance_paise from public.end_down(5000) $$, $$ values (5000::bigint) $$, 'one ₹50 chip over');
reset role;
select is((select count(*)::int from public.alert where kind = 'dealer.variance'), 2, 'with no threshold set, even ₹50 raises an alert');

-- A down with hands that closes without a count, as dealer sign-in elsewhere closes it, raises an alert.
select pg_temp.start_down();
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select lives_ok($$ select public.log_hand(4800000, 'holdem', now(), 'end-of-down-hand-3') $$, 'a ₹48,000 hand in a down never counted');
reset role;
update public.dealer_down set ended_at = now() where ended_at is null;
select results_eq($$ select (detail ->> 'logged_paise')::bigint from public.alert where kind = 'dealer.uncounted' $$,
  $$ values (250000::bigint) $$, 'the floor and the owner are told to count that box by hand');
select pg_temp.start_down();
update public.dealer_down set ended_at = now() where ended_at is null;
select is((select count(*)::int from public.alert where kind = 'dealer.uncounted'), 1, 'a down with no hands has nothing to count');

-- Who sees counts: staff who read the ledger, at their own venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::int from public.down_count c join public.dealer_down d on d.id = c.down_id
           where d.device_id = '00000000-0000-4000-8000-00000000d001'), 4, 'an admin, who reads the ledger, sees the venue''s down counts');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.down_count $$, 'a dealer, who does not read the ledger, sees none, not even her own');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select is_empty($$ select * from public.down_count $$, 'nor does the tablet, which gets its own back from end_down');
select throws_ok($$ insert into public.down_count (down_id, venue_id, drop_box_paise, logged_paise, variance_paise)
                    select id, venue_id, 0, 0, 0 from public.dealer_down limit 1 $$, '42501', null, 'nor writes one');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.down_count $$, 'nor does a member');
reset role;
update public.staff set is_active = false
where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.down_count where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'staff at the practice venue only see none of the club''s counts');
reset role;

select * from finish();
rollback;
