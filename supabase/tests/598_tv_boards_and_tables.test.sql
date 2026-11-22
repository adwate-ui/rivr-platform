-- Pairing a TV with several boards and its tables (the owner, 22 Nov): the first board is its main one and the rest the
-- boards it turns to; its call time board shows only the tables it was given, every table with none; staff change its
-- tables on its row. Every TV not yet paired gets its code at once: window-only pairing went. 103 Aditya is a floor
-- manager (admin), 108 a host; Ishaan (211) and Vihaan (212) are seated here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor is set aside, so this test seats its own players.
delete from public.tablet_assignment;
update public.seat_session set ended_at = now(), end_reason = 'left' where ended_at is null;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;

-- A code at once, with nothing pressed on the console.
set local role service_role;
create temporary table hall on commit drop as select * from public.start_tv_pairing('203.0.113.77');
reset role;
grant select on hall to authenticated;
select ok((select code ~ '^[0-9]{6}$' and refusal is null from hall), 'a TV asking is given its code at once');
select ok(to_regprocedure('public.open_tv_pairing_window(uuid)') is null and to_regprocedure('public.tv_pairing_policy(uuid)') is null
          and to_regprocedure('public.set_tv_pairing_window_only(uuid, boolean)') is null, 'there is no pairing window to open or switch on');

-- Pairing takes the boards in order and the tables.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from hall), 'Hall TV', '{}'::public.tv_mode[], '{}') $$,
  '22023', null, 'a TV shows at least one board');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from hall), 'Hall TV',
                      array['waitlist', 'waitlist']::public.tv_mode[], '{}') $$, '22023', null, 'each board once');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from hall), 'Hall TV',
                      array['call_time']::public.tv_mode[], array[gen_random_uuid()]) $$, '22023', null, 'its tables are the venue''s');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from hall), 'Hall TV',
                      array['call_time']::public.tv_mode[], array[pg_temp.t('Table 3'), pg_temp.t('Table 3')]) $$, '22023', null, 'each once');
select throws_ok($$ select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from hall), 'Hall TV',
                      array['call_time']::public.tv_mode[],
                      array(select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000002' limit 1)) $$,
  '22023', null, 'never another venue''s');
create temp table hall_tv on commit drop as
  select public.claim_tv_pairing('00000000-0000-4000-8000-000000000001', (select code from hall), 'Hall TV',
                                 array['call_time', 'waitlist', 'promotions']::public.tv_mode[], array[pg_temp.t('Table 3')]) as device_id;
reset role;
grant select on hall_tv to authenticated;
select results_eq($$ select mode, rotation, tables from public.tv_screen where device_id = (select device_id from hall_tv) $$,
  $$ values ('call_time'::public.tv_mode, array['waitlist', 'promotions']::public.tv_mode[], array[pg_temp.t('Table 3')]) $$,
  'the first board is its main one, the rest what it turns to, with its tables');
select ok(exists (select 1 from public.audit_log where action = 'device.paired' and entity_id = (select device_id::text from hall_tv)),
  'the pairing is audited');

-- A signed-in TV showing the call time board, for Table 3 alone.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e598', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000598');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d598', '00000000-0000-4000-8000-000000000001', 'tv', 'Rail TV', '00000000-0000-4000-8000-00000000e598');
insert into public.tv_screen (device_id, venue_id, mode, tables) values
  ('00000000-0000-4000-8000-00000000d598', '00000000-0000-4000-8000-000000000001', 'call_time', array[pg_temp.t('Table 3')]);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.t('Private Room'), 1, '9000000211');
select public.seat_member(pg_temp.t('Table 3'), 2, '9000000212');

select pg_temp.as_person('00000000-0000-4000-8000-00000000e598');
select results_eq($$ select table_name, seat from public.tv_call_time_board() $$, $$ values ('Table 3'::text, 2) $$,
  'the TV''s call time board shows its own table alone');

-- Changed on its row: none is every table, then the Private Room alone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_tv_tables('00000000-0000-4000-8000-00000000d598', '{}') $$, 'the floor clears its tables');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e598');
select results_eq($$ select table_name, seat from public.tv_call_time_board() $$,
  $$ values ('Table 3'::text, 2), ('Private Room', 1) $$, 'with none, it shows every table');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_tv_tables('00000000-0000-4000-8000-00000000d598', array[pg_temp.t('Private Room')]) $$, 'and gives it the Private Room');
select throws_ok($$ select public.set_tv_tables('00000000-0000-4000-8000-00000000d598', array[gen_random_uuid()]) $$, '22023', null,
  'never a table the venue does not have');
select throws_ok($$ select public.set_tv_tables('00000000-0000-4000-8000-00000000d598', null) $$, '22023', null, 'and a list, if an empty one');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e598');
select results_eq($$ select table_name, seat from public.tv_call_time_board() $$, $$ values ('Private Room'::text, 1) $$,
  'the board follows');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.set_tv_tables('00000000-0000-4000-8000-00000000d598', '{}') $$, '42501', null, 'a host changes no TV''s tables');
reset role;

select * from finish();
rollback;
