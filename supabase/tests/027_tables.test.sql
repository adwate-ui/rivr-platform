-- Table types and the six tables (#34). 201 Arjun (member of the club), 104 Sana (cashier at the club
-- and the practice venue), 103 Aditya (admin: floor.manage), 106 Pema (dealer), and an "Elsewhere"
-- venue's cashier made here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000f2', 'authenticated', 'authenticated', '919000000996', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000f2', 'Elsewhere Cashier', 'Cashier', 'cashier');

-- The seed: the design prompt's tables in both venues.
select results_eq(
  $$ select t.name, tt.code, t.is_open from public.game_table t join public.table_type tt on tt.id = t.table_type_id
     where t.venue_id = '00000000-0000-4000-8000-000000000001' order by t.position $$,
  $$ values ('Table 1'::text, 'nlh_50_100'::text, true), ('Table 2', 'nlh_100_200', true), ('Table 3', 'nlh_100_200', true),
            ('Table 4', 'nlh_100_200', false), ('Table 5', 'nlh_100_200', true), ('Private Room', 'private_room', true) $$,
  'the club has Tables 1 to 5 (Table 4 closed) and the Private Room');
select is((select count(*)::integer from public.game_table where venue_id = '00000000-0000-4000-8000-000000000002'), 6,
  'and so does the practice venue');
select results_eq(
  $$ select code, small_blind_paise, big_blind_paise, buy_in_min_paise, buy_in_max_paise, straddle_paise, has_variation
     from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' order by buy_in_min_paise $$,
  $$ values ('nlh_50_100'::text, 5000::bigint, 10000::bigint, 500000::bigint, 500000::bigint, null::bigint, false),
            ('nlh_100_200', 10000, 20000, 1000000, 1000000, null, true),
            ('private_room', 10000, 20000, 2000000, 2000000, 50000, false) $$,
  '50/100 at ₹5,000; 100/200 at ₹10,000 with the variation button; the Private Room at ₹20,000 with a ₹500 straddle');

-- Rake lives in effective-dated settings.
select results_eq(
  $$ select r.code, private.setting_at('00000000-0000-4000-8000-000000000001', 'rake.config', r.code, now())
     from (values ('nlh_50_100'), ('nlh_100_200'), ('private_room')) as r (code) $$,
  $$ values ('nlh_50_100'::text, '{"rate_basis_points": 500, "cap_paise": 300000}'::jsonb),
            ('nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 600000}'),
            ('private_room', '{"rate_basis_points": 500, "cap_paise": 1200000}') $$,
  'rake is 5% with a ₹3,000, ₹6,000 or ₹12,000 cap, from the settings in force');
select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'jackpot.drop', '', now()),
  '{"drop_paise": 10000, "above_paise": 500000}'::jsonb, 'and the jackpot drop is ₹100 above ₹5,000');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from)
                    values ('00000000-0000-4000-8000-000000000001', 'rake.config', 'nlh_50_100',
                            '{"rate_basis_points": 500, "cap_paise": 299950}', now() + interval '1 day') $$,
  '23514', null, 'a cap that is not a whole number of ₹50 chips is refused');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from)
                   values ('00000000-0000-4000-8000-000000000001', 'rake.config', 'nlh_50_100',
                           '{"rate_basis_points": 500, "cap_paise": 350000}', now() + interval '1 day') $$,
  'a new cap takes effect from a future time');
select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'rake.config', 'nlh_50_100', now()) ->> 'cap_paise', '300000',
  'and until then the old cap is in force');

-- Who sees and changes what.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select count(*)::integer from public.game_table), 6, 'a member sees their venue''s six tables, not the practice venue''s');
select is((select count(*)::integer from public.table_type), 3, 'and its three table types');
select throws_ok($$ insert into public.game_table (venue_id, table_type_id, name, position)
                    select venue_id, id, 'Table 9', 9 from public.table_type limit 1 $$,
  '42501', null, 'a member cannot add a table');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select is((select count(*)::integer from public.game_table), 12, 'a cashier at both venues sees both venues'' tables');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000f2", "role": "authenticated"}';
select is_empty($$ select * from public.game_table where venue_id <> '00000000-0000-4000-8000-0000000000f1' $$,
  'staff of another venue see none of these tables');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000106", "role": "authenticated"}';
update public.game_table set is_open = true where name = 'Table 4';
reset role;
select is((select is_open from public.game_table where name = 'Table 4' and venue_id = '00000000-0000-4000-8000-000000000001'), false,
  'a dealer cannot open a table');
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
update public.game_table set is_open = true where name = 'Table 4' and venue_id = '00000000-0000-4000-8000-000000000001';
reset role;
select is((select is_open from public.game_table where name = 'Table 4' and venue_id = '00000000-0000-4000-8000-000000000001'), true,
  'a floor manager opens Table 4');

select * from finish();
rollback;
