-- The table's own minimum buy-in (redesign RD-16): required, a whole ₹50 above zero, with no maximum; existing tables took their
-- stake's.
-- The super admin (101 Vikram) sets it with the table; a member (201 Arjun) reads their own venue's; staff of another venue
-- none; the website reads the club's and never the practice venue's. 111 Zoya, a host, sets up nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.club_table(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.club_table(text) to authenticated;
create function pg_temp.min_buy_in(p_name text) returns bigint language sql security definer as $$
  select min_buy_in_paise from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- The column: required, with no default, and a whole ₹50 above zero.
select col_not_null('public', 'game_table', 'min_buy_in_paise', 'a table always has a minimum buy-in');
select col_hasnt_default('public', 'game_table', 'min_buy_in_paise', 'which nothing assumes for it');
select col_type_is('public', 'game_table', 'min_buy_in_paise', 'bigint', 'in integer paise');
select throws_ok($$ update public.game_table set min_buy_in_paise = 0 where id = pg_temp.club_table('Table 1') $$,
  '23514', null, 'a minimum buy-in of nothing is refused by the table itself');
select throws_ok($$ update public.game_table set min_buy_in_paise = -500000 where id = pg_temp.club_table('Table 1') $$,
  '23514', null, 'and one below nothing');
select throws_ok($$ update public.game_table set min_buy_in_paise = 734900 where id = pg_temp.club_table('Table 1') $$,
  '23514', null, 'and ₹7,349, which is no whole ₹50');
select throws_ok($$ update public.game_table set min_buy_in_paise = null where id = pg_temp.club_table('Table 1') $$,
  '23502', null, 'and none at all');

-- The backfill: as before the migration, no table has one; then its own statement, word for word.
alter table public.game_table alter column min_buy_in_paise drop not null;
update public.game_table set min_buy_in_paise = null;
update public.game_table g set min_buy_in_paise = t.buy_in_min_paise from public.table_type t where t.id = g.table_type_id;
select is_empty($$ select g.name from public.game_table g join public.table_type t on t.id = g.table_type_id
                   where g.min_buy_in_paise is distinct from t.buy_in_min_paise $$,
  'every existing table takes its stake''s present minimum');
select results_eq($$ select name, min_buy_in_paise from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' order by position $$,
  $$ values ('Table 1'::text, 500000::bigint), ('Table 2', 1000000), ('Table 3', 1000000), ('Table 4', 1000000), ('Table 5', 1000000), ('Private Room', 2000000) $$,
  'Table 1 at ₹5,000, Tables 2 to 5 at ₹10,000, the Private Room at ₹20,000');
select lives_ok($$ alter table public.game_table alter column min_buy_in_paise set not null $$, 'which leaves none without one');

-- Set with the table.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into ids select 'table', public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 9',
  (select id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'nlh_100_200'), 9, 735000);
select throws_ok($$ select public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 10',
                    (select id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'nlh_100_200'), 9, 0) $$,
  '22023', 'A table has a name of its own, a stake at this venue, 2 to 10 seats and a minimum buy-in in whole 50s', 'a new table with a minimum of nothing is refused');
select throws_ok($$ select public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 10',
                    (select id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'nlh_100_200'), 9, null) $$,
  '22023', 'A table has a name of its own, a stake at this venue, 2 to 10 seats and a minimum buy-in in whole 50s', 'and one with none');
select throws_ok($$ select public.add_game_table('00000000-0000-4000-8000-000000000001', 'Table 10',
                    (select id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'nlh_100_200'), 9, 734900) $$,
  '22023', 'A table has a name of its own, a stake at this venue, 2 to 10 seats and a minimum buy-in in whole 50s', 'and one of ₹7,349: not a whole ₹50');
reset role;
select is(pg_temp.min_buy_in('Table 9'), 735000::bigint, 'a new table has the minimum typed for it, ₹7,350, not its stake''s ₹10,000');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_game_table((select id from ids where name = 'table'), 'Table 9', (select table_type_id from public.game_table where id = (select id from ids where name = 'table')), 9, 5000000000) $$,
  'an admin raises it to ₹5,00,00,000: there is no maximum');
select throws_ok($$ select public.set_game_table((select id from ids where name = 'table'), 'Table 9', (select table_type_id from public.game_table where id = (select id from ids where name = 'table')), 9, 0) $$,
  '22023', 'A table has a name of its own, a stake at this venue, 2 to 10 seats and a minimum buy-in in whole 50s', 'but never to nothing');
select lives_ok($$ select public.set_game_table((select id from ids where name = 'table'), 'Table 9', (select table_type_id from public.game_table where id = (select id from ids where name = 'table')), 8) $$,
  'a change that leaves it out, as an older console sends it');
reset role;
select is(pg_temp.min_buy_in('Table 9'), 5000000000::bigint, 'keeps the table''s own');
select is((select seats from public.game_table where id = (select id from ids where name = 'table')), 8, 'and still changes its seats');
select is((select buy_in_min_paise from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'nlh_100_200'), 1000000::bigint,
  'the stake''s own figure is untouched by its table''s');

-- The dealer's ring reads the table's own minimum, not its stake's ₹10,000.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e421', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000421');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d421', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet 421', '00000000-0000-4000-8000-00000000e421');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d421', '00000000-0000-4000-8000-000000000001', id from ids where name = 'table';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e421');
select results_eq($$ select distinct minimum_paise from public.tablet_seats() $$, $$ values (5000000000::bigint) $$,
  'the tablet at Table 9 shows the table''s own minimum on every seat');
reset role;

-- Who reads and writes it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select name, min_buy_in_paise from public.game_table where name in ('Table 1', 'Table 2') order by name $$,
  $$ values ('Table 1'::text, 500000::bigint), ('Table 2', 1000000) $$, 'a member reads the minimum buy-in of their own venue''s tables');
select is_empty($$ select 1 from public.game_table where venue_id = '00000000-0000-4000-8000-000000000002' $$, 'and none of the practice venue''s');
select throws_ok($$ update public.game_table set min_buy_in_paise = 100 where name = 'Table 1' $$, '42501', null, 'and changes none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000111');
select throws_ok($$ update public.game_table set min_buy_in_paise = 100 where name = 'Table 1' $$, '42501', null, 'a host changes none by the API');
select throws_ok($$ select public.set_game_table(pg_temp.club_table('Table 1'), 'Table 1', (select table_type_id from public.game_table where id = pg_temp.club_table('Table 1')), 9, 100) $$,
  '42501', null, 'nor through setup');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select 1 from public.game_table where venue_id <> '00000000-0000-4000-8000-0000000000e1' $$, 'staff of another venue read none of these tables');
select throws_ok($$ select public.set_game_table(pg_temp.club_table('Table 1'), 'Table 1', (select id from public.table_type limit 1), 9, 100) $$,
  '42501', null, 'and set no minimum here');
reset role;
select is(pg_temp.min_buy_in('Table 1'), 500000::bigint, 'so Table 1 keeps its ₹5,000');

-- The website's games read each table's own, and never the practice venue's.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.set_game_table(pg_temp.club_table('Table 4'), 'Table 4', (select table_type_id from public.game_table where id = pg_temp.club_table('Table 4')), 9, 2500000) $$,
  'the super admin sets Table 4 to ₹25,000');
reset role;
set local role anon;
select results_eq($$ select table_name, buy_in_min_paise, buy_in_max_paise >= buy_in_min_paise from public.public_table_status
                     where venue_slug = 'gurugram' and table_name in ('Table 3', 'Table 4') order by table_name $$,
  $$ values ('Table 3'::text, 1000000::bigint, true), ('Table 4', 2500000, true) $$,
  'the website reads each table''s own minimum, with no maximum below it');
reset role;
select is_empty($$ select 1 from public.public_table_status s join public.venue v on v.slug = s.venue_slug where v.is_practice $$,
  'and nothing of the practice venue');

-- Nobody signed out reads how many are seated (owner, 8 Nov and 15 Nov), though the floor has seated a player.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member(pg_temp.club_table('Table 3'), 2, '9000000211'), null, 'the floor seats a member at Table 3');
reset role;
set local role anon;
select ok((select count(*) > 0 from public.public_table_status where venue_slug = 'gurugram'), 'the public read still lists the club''s tables');
select is_empty($$ select table_name from public.public_table_status where seats_taken is not null $$,
  'with no count of seats taken at any of them');
reset role;

select is(has_function_privilege('anon', 'public.set_game_table(uuid, text, uuid, integer, bigint)', 'execute'), false, 'nobody signed out changes a table');

select * from finish();
rollback;
