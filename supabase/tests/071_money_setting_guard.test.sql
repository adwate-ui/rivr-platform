-- Money settings guarded in the database (#323; answers to #302 and #296). 103 Aditya is an admin who
-- manages settings. A tablet's clock may run a minute ahead, so for rake.config, jackpot.drop and
-- jackpot.shares nobody signed in schedules a value a minute or less away, nor withdraws one within a
-- minute of taking effect; and a jackpot drop's pot threshold is never below the drop.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table gone (n integer);
grant select, insert, delete on gone to authenticated;

-- A minute's notice for each money key, through the API as any client calls it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 700000}', now() + interval '30 seconds') $$, 'RVMIN', null,
  'no rake change half a minute away');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 700000}', now() + interval '1 minute') $$, 'RVMIN', null,
  'nor exactly a minute away');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'jackpot.drop', '', '{"drop_paise": 10000, "above_paise": 500000}', now()) $$, 'RVMIN', null, 'nor a jackpot drop from now');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'jackpot.shares', '', '{"season_basis_points": 1000, "freeroll_basis_points": 1000}', now() + interval '20 seconds') $$, 'RVMIN', null,
  'nor jackpot shares');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 700000}', now() + interval '61 seconds') $$,
  'a rake change just over a minute away is taken');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 500000}', now() + interval '2 hours') $$,
  'as is one two hours away');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'call_time.minutes', 'nlh_100_200', '{"minutes": 45}', now()) $$, 'a setting that is not money still takes effect now');

-- Withdrawing: a money change more than a minute away goes; one within the minute stays.
with d as (delete from public.setting where key = 'rake.config' and subject = 'nlh_100_200'
                            and effective_from = now() + interval '61 seconds' returning 1) insert into gone select count(*) from d;
select is((select n from gone), 1, 'a rake change just over a minute away can still be withdrawn');
delete from gone;
with d as (delete from public.setting where key = 'rake.config' and subject = 'nlh_100_200'
                            and effective_from = now() + interval '2 hours' returning 1) insert into gone select count(*) from d;
select is((select n from gone), 1, 'one two hours away is withdrawn');
reset role;
-- Written as a migration writes it, with nobody signed in: a rake change half a minute away.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-000000000001', 'rake.config', 'nlh_50_100', '{"rate_basis_points": 500, "cap_paise": 300000}', now() + interval '30 seconds', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
delete from gone;
with d as (delete from public.setting where key = 'rake.config' and subject = 'nlh_50_100'
                            and effective_from = now() + interval '30 seconds' returning 1) insert into gone select count(*) from d;
select is((select n from gone), 0, 'a money change half a minute from taking effect is never withdrawn');
reset role;
select is((select count(*)::integer from public.setting where key = 'rake.config' and subject = 'nlh_50_100' and effective_from = now() + interval '30 seconds'),
  1, 'and it stands');

-- A jackpot drop comes only from pots above at least the drop, from anyone, signed in or not.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'jackpot.drop', '', '{"drop_paise": 10000, "above_paise": 5000}', now() + interval '1 hour') $$, '23514',
  'a jackpot drop comes only from pots above at least the drop', 'a ₹100 drop from pots above ₹50 is refused');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'jackpot.drop', '', '{"drop_paise": 10000, "above_paise": 10000}', now() + interval '1 hour') $$, 'a ₹100 drop from pots above ₹100 is taken');
reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000002',
  'jackpot.drop', '', '{"drop_paise": 10000, "above_paise": 0}', now() + interval '1 hour') $$, '23514',
  'a jackpot drop comes only from pots above at least the drop', 'nor even by a migration, with nobody signed in');

-- Within the minute, a setting that is not money is still withdrawn; a jackpot drop is not.
insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'nlh_50_100', '{"minutes": 30}', now() + interval '30 seconds', 'Test'),
  ('00000000-0000-4000-8000-000000000001', 'jackpot.drop', '', '{"drop_paise": 10000, "above_paise": 600000}', now() + interval '30 seconds', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
delete from gone;
with d as (delete from public.setting where key = 'call_time.minutes' and subject = 'nlh_50_100' and effective_from = now() + interval '30 seconds'
           returning 1) insert into gone select count(*) from d;
select is((select n from gone), 1, 'a call-time change half a minute away is withdrawn');
delete from gone;
with d as (delete from public.setting where key = 'jackpot.drop' and effective_from = now() + interval '30 seconds' returning 1)
insert into gone select count(*) from d;
select is((select n from gone), 0, 'a jackpot drop half a minute away is not');
reset role;

select * from finish();
rollback;
