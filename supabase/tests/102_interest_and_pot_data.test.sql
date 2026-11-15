-- Interest lists (#113; decision 0184). The Private Room is closed here: its own
-- waitlist (decision 0467) is its interest list, and once as many wait as the venue's
-- waitlist.interest_to_open (3), the floor (103 Aditya, waitlist.manage) is told. A dealer (106 Pema) is
-- not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table game as
select g.table_type_id as id, g.id as table_id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Private Room';
grant select on game to authenticated;
create function pg_temp.wait(p_member text) returns void language sql as $$
  insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key)
  select '00000000-0000-4000-8000-000000000001', p_member::uuid, game.id, game.table_id, gen_random_uuid() from game;
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
                     where table_id = (select table_id from game) $$,
  $$ values (2, 3, false) $$, 'two waiting for a closed table: its interest list, short of the three that open it');
reset role;
-- Kunal, his identity check done, registers interest from the app: joining the table's list, as for any table.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'verified', 'digilocker', '1991-02-16', 'ABCPM2161K',
       '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000216/selfie.jpg', now()
where not private.is_kyc_complete('00000000-0000-4000-8000-000000000216');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select lives_ok($$ select public.join_waitlist_at((select table_id from game), gen_random_uuid()) $$, 'a member registers interest in a closed table');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select waiting, is_ready from public.interest_lists('00000000-0000-4000-8000-000000000001') where table_id = (select table_id from game) $$,
  $$ values (3, true) $$, 'the third tells the floor to open it');
-- Elsewhere's floor sees nothing of the club's.
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select * from public.interest_lists('00000000-0000-4000-8000-000000000001') $$, 'Elsewhere''s floor sees no interest at the club');
select ok(not exists (select 1 from public.interest_lists('00000000-0000-4000-8000-000000000001') l
                      join public.game_table g on g.id = l.table_id and g.is_open),
  'an open table has no interest list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.interest_lists('00000000-0000-4000-8000-000000000001') $$, 'a dealer is not told');
reset role;
update public.game_table set is_open = true where id = (select table_id from game);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.interest_lists('00000000-0000-4000-8000-000000000001') where table_id = (select table_id from game) $$,
  'once the table opens, the list is its waitlist again');
select is((select count(*)::integer from public.waitlist_entry where status = 'waiting' and table_type_id = (select id from game)), 3,
  'with the three in the order they registered');

select * from finish();
rollback;
