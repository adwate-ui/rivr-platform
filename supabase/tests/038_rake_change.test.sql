-- Rake and cap changes from the console (#37, scope-v1 module 3 acceptance): an admin adds a
-- rake.config row for a table type from a time; the lookup gives each moment the rule in force
-- then, and a hand played before the change keeps the old cap. Nobody signed in backdates a rule,
-- values are whole chips and at most 10%, only setting managers add rules, and a change is
-- withdrawn only before it takes effect. 103 Aditya and 110 Rhea are admins; 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.cap_at(p_at timestamptz) returns bigint language sql as $$
  select cap_paise from private.rake_rules_at(
    (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), p_at);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- An admin's two changes, through row-level security as the console sends them: the seed's ₹6,000
-- cap, ₹7,000 from an hour on, ₹5,000 from three hours on. (The lookup itself is proved on
-- packages/testing/golden/settings.json in 024.)
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-000000000001', 'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 700000}',
   now() + interval '1 hour', 'Weekend cap'),
  ('00000000-0000-4000-8000-000000000001', 'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 500000}',
   now() + interval '3 hours', 'Back to quiet nights');
reset role;
select results_eq(
  $$ select pg_temp.cap_at(now() + at_offset) from (values (interval '0'), (interval '59 minutes 59 seconds'), (interval '1 hour'),
       (interval '2 hours 59 minutes 59 seconds'), (interval '3 hours'), (interval '1 year')) as cases (at_offset) $$,
  $$ values (600000::bigint), (600000::bigint), (700000::bigint), (700000::bigint), (500000::bigint), (500000::bigint) $$,
  'each moment takes the cap in force then: ₹6,000 until the hour, ₹7,000 until the third, ₹5,000 after');
select is((select count(*)::integer from public.audit_log where entity = 'setting' and occurred_at = now()), 2,
  'both changes are audited');

-- What a setting manager may not do.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 300000}', now() - interval '10 minutes') $$, '23514', null,
  'no change takes effect in the past');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 600010}', now() + interval '5 hours') $$, '23514', null,
  'a cap is whole ₹50 chips');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 1500, "cap_paise": 600000}', now() + interval '5 hours') $$, '23514', null,
  'a rate is at most 10%');
select is((select count(*)::integer from public.setting where key = 'rake.config' and subject = 'nlh_100_200' and effective_from > now()), 2,
  'the admin reads the changes to come');
delete from public.setting where key = 'rake.config' and subject = 'nlh_100_200' and effective_from = now() + interval '3 hours';
delete from public.setting where key = 'rake.config' and subject = 'nlh_100_200' and effective_from = '-infinity';
reset role;
select is(pg_temp.cap_at(now() + interval '4 hours'), 700000::bigint, 'a change not yet in force is withdrawn');
select is(pg_temp.cap_at(now()), 600000::bigint, 'but the rule in force stays');

-- Who may change rake: setting managers, at their own venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 100000}', now() + interval '5 hours') $$, '42501', null,
  'a dealer changes no rake');
reset role;
update public.staff set is_active = false
where user_id = '00000000-0000-4000-8000-000000000110' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000110');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000001',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 100000}', now() + interval '5 hours') $$, '42501', null,
  'nor does an admin of the practice venue only, at the club');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from) values ('00000000-0000-4000-8000-000000000002',
  'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 100000}', now() + interval '5 hours') $$,
  'though she changes the practice venue''s');
reset role;

-- Hands before the change keep the old rule: Pema's down began two hours ago, and a change to a
-- ₹3,000 cap, scheduled earlier, took effect half an hour ago (written as a migration writes it,
-- with nobody signed in, since the console schedules only more than a minute ahead).
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at)
select a.venue_id, a.table_id, s.id, a.device_id, now() - interval '2 hours'
from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id
where a.device_id = '00000000-0000-4000-8000-00000000d001';
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-000000000001', 'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 300000}',
   now() - interval '30 minutes', 'Lower cap');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table hands on commit drop as
select public.log_hand(14000000, 'holdem', now() - interval '1 hour', 'cap-change-before') as hand_id, 'before' as played
union all select public.log_hand(14000000, 'holdem', now(), 'cap-change-after'), 'after';
reset role;
select results_eq($$ select h.played, x.rake_paise, x.is_cap_applied from public.hand x join hands h on h.hand_id = x.id order by h.played $$,
  $$ values ('after', 300000::bigint, true), ('before', 600000::bigint, true) $$,
  'a ₹1,40,000 pot played before the change is raked ₹6,000; after it, ₹3,000');

select * from finish();
rollback;
