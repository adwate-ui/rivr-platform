-- Interest lists (#113; decision 0184) and pot data (#114; decision 0185). The Private Room's game is not
-- running here: its waitlist is its interest list, and once as many wait as the venue's
-- waitlist.interest_to_open (3), the floor (103 Aditya, waitlist.manage) is told. A cashier (104 Sana) is
-- not. Pot data is the super admin's (101 Vikram): every hand in a period; the admin and the cashier see none.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table game as
select g.table_type_id as id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Private Room';
grant select on game to authenticated;
create function pg_temp.wait(p_member text) returns void language sql as $$
  insert into public.waitlist_entry (venue_id, member_id, table_type_id, idempotency_key)
  select '00000000-0000-4000-8000-000000000001', p_member::uuid, game.id, gen_random_uuid() from game;
$$;

-- Elsewhere, a venue made here before anyone signs in, with its own owner.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Owner', 'Owner', 'super_admin');

-- The game's tables close and its list empties; the venue opens a table at three.
update public.seat_session set ended_at = now(), end_reason = 'left'
where ended_at is null and table_id in (select g.id from public.game_table g where g.table_type_id = (select id from game));
update public.game_table set is_open = false where table_type_id = (select id from game);
update public.waitlist_entry set status = 'left', left_at = now() where status = 'waiting' and table_type_id = (select id from game);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'waitlist.interest_to_open', '', '{"players": 3}', now(), 'Test');

select pg_temp.wait('00000000-0000-4000-8000-000000000213');
select pg_temp.wait('00000000-0000-4000-8000-000000000214');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select waiting, players_to_open, is_ready from public.interest_lists('00000000-0000-4000-8000-000000000001')
                     where table_type_id = (select id from game) $$,
  $$ values (2, 3, false) $$, 'two waiting for a game not running: its interest list, short of the three that open a table');
reset role;
-- Kunal, his identity check done, registers interest from the app: joining the game's list, as for any game.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'verified', 'digilocker', '1991-02-16', 'ABCPM2161K',
       '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000216/selfie.jpg', now()
where not private.is_kyc_complete('00000000-0000-4000-8000-000000000216');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select lives_ok($$ select public.join_waitlist((select id from game), gen_random_uuid()) $$, 'a member registers interest in a game not running');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select waiting, is_ready from public.interest_lists('00000000-0000-4000-8000-000000000001') where table_type_id = (select id from game) $$,
  $$ values (3, true) $$, 'the third tells the floor to open a table');
-- Elsewhere's floor sees nothing of the club's.
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select * from public.interest_lists('00000000-0000-4000-8000-000000000001') $$, 'Elsewhere''s floor sees no interest at the club');
select is_empty($$ select * from public.pot_data('00000000-0000-4000-8000-000000000001', '-infinity', 'infinity') $$, 'nor its hands');
select ok(not exists (select 1 from public.interest_lists('00000000-0000-4000-8000-000000000001') l
                      join public.game_table g on g.table_type_id = l.table_type_id and g.is_open),
  'a game with a table open has no interest list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.interest_lists('00000000-0000-4000-8000-000000000001') $$, 'the cage is not told');
reset role;
update public.game_table set is_open = true where id = (select g.id from public.game_table g where g.table_type_id = (select id from game) limit 1);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.interest_lists('00000000-0000-4000-8000-000000000001') where table_type_id = (select id from game) $$,
  'once a table opens, the list is its waitlist again');
select is((select count(*)::integer from public.waitlist_entry where status = 'waiting' and table_type_id = (select id from game)), 3,
  'with the three in the order they registered');

-- Pot data: a hand on Sunday 4 January 2026 at 21:00 IST.
reset role;
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001021');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet Q', '00000000-0000-4000-8000-00000000e102');
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-00000000c102', '00000000-0000-4000-8000-000000000001', g.id, s.id, '00000000-0000-4000-8000-00000000d102',
       '2026-01-04T20:00:00+05:30', '2026-01-04T22:00:00+05:30'
from public.staff s cross join public.game_table g
where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001'
  and g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied,
                         played_at, idempotency_key)
select d.venue_id, d.table_id, d.id, d.staff_id, d.device_id, 'plo', 1000000, 50000, 10000, false, '2026-01-04T21:00:00+05:30', 'pot-data-hand-1'
from public.dealer_down d where d.id = '00000000-0000-4000-8000-00000000c102';

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq(
  $$ select table_name, dealer_name, variant, pot_paise, rake_paise, drop_paise, is_cap_applied, high_hand
     from public.pot_data('00000000-0000-4000-8000-000000000001', '2026-01-04T06:00:00+05:30', '2026-01-05T06:00:00+05:30') $$,
  $$ values ('Table 2'::text, 'Pema Lepcha'::text, 'plo'::text, 1000000::bigint, 50000::bigint, 10000::bigint, false, null::text) $$,
  'the super admin sees the club day''s hand: table, dealer, variant, pot, rake and drop');
select is_empty($$ select * from public.pot_data('00000000-0000-4000-8000-000000000001', '2026-01-05T06:00:00+05:30', '2026-01-06T06:00:00+05:30') $$,
  'and none on the next day');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.pot_data('00000000-0000-4000-8000-000000000001', '2026-01-04T06:00:00+05:30', '2026-01-05T06:00:00+05:30') $$,
  'an admin sees no pot data');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.pot_data('00000000-0000-4000-8000-000000000001', '2026-01-04T06:00:00+05:30', '2026-01-05T06:00:00+05:30') $$,
  'nor does the cage');

select * from finish();
rollback;
