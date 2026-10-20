-- The console's Settings screen (#33, decision 0104): setting managers schedule and withdraw effective-dated
-- settings, which the database checks against each key's schema; super admins change the venue
-- configuration and the chip denominations; every change is audited; cashiers and dealers change nothing.
-- 101 Vikram is a super admin, 103 Aditya an admin, 104 Sana a cashier, 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated, anon;

-- Aditya, an admin (settings.manage, not venue.configure).
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ insert into public.setting (venue_id, key, value, effective_from, reason)
                   values ('00000000-0000-4000-8000-000000000001', 'waitlist.hold_minutes', '{"minutes": 12}', now() + interval '1 day', 'Busier nights') $$,
  'an admin schedules a setting from tomorrow');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                   values ('00000000-0000-4000-8000-000000000001', 'call_time.minutes', 'nlh_100_200', '{"minutes": 45}', now(), 'From tonight') $$,
  'and one for a table type from now');
select throws_ok($$ insert into public.setting (venue_id, key, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'waitlist.hold_minutes', '{"minutes": 500}', now() + interval '1 day', 'No') $$,
  '23514', 'value for waitlist.hold_minutes does not match its schema', 'the database refuses a value its schema does not allow');
select throws_ok($$ insert into public.setting (venue_id, key, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'waitlist.hold_minutes', '{"minutes": 10}', now() - interval '1 day', 'No') $$,
  '23514', 'settings cannot take effect in the past', 'and a value from the past');
select throws_ok($$ insert into public.setting (venue_id, key, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'jackpot.payout',
                            '{"pool_basis_points": 10000, "loser_basis_points": 5000, "winner_basis_points": 3000, "table_basis_points": 1000}',
                            now() + interval '1 day', 'No') $$,
  '23514', 'a bad beat''s split between the loser, the winner and the table makes 100%', 'and a bad beat split that does not make 100%');
select lives_ok($$ insert into public.setting (venue_id, key, value, reason)
                   values ('00000000-0000-4000-8000-000000000001', 'markers.due_days', '{"days": 21}', 'From now') $$,
  'a value with no time given');
select is((select effective_from from public.setting where key = 'markers.due_days' and reason = 'From now'), now(),
  'is from the database''s now');
select is((select count(*)::integer from public.setting where key = 'waitlist.hold_minutes' and reason = 'Busier nights'), 1,
  'the admin sees the change to come');
select results_eq($$ delete from public.setting where key = 'waitlist.hold_minutes' and reason = 'Busier nights' returning reason $$,
  $$ values ('Busier nights'::text) $$, 'and withdraws it before it takes effect');
select is_empty($$ delete from public.setting where key = 'call_time.minutes' and reason = 'From tonight' returning id $$,
  'but not one already in force');
update public.venue_config set alert_whatsapp = '+919876543210' where venue_id = '00000000-0000-4000-8000-000000000001';
select throws_ok($$ insert into public.chip_denomination (venue_id, value_paise, name) values ('00000000-0000-4000-8000-000000000001', 200000, '₹2,000') $$,
  '42501', null, 'an admin cannot add a chip');
select is_empty($$ update public.chip_denomination set is_active = false where venue_id = '00000000-0000-4000-8000-000000000001' returning id $$,
  'nor change one');

-- Sana, a cashier, and Pema, a dealer.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ insert into public.setting (venue_id, key, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'waitlist.hold_minutes', '{"minutes": 12}', now() + interval '1 day', 'No') $$,
  '42501', null, 'a cashier cannot schedule a setting');
select is_empty($$ delete from public.setting where venue_id = '00000000-0000-4000-8000-000000000001' and effective_from > now() returning id $$,
  'nor withdraw one');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ insert into public.chip_denomination (venue_id, value_paise, name) values ('00000000-0000-4000-8000-000000000001', 200000, '₹2,000') $$,
  '42501', null, 'a dealer cannot add a chip');

-- Vikram, a super admin.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
update public.venue_config set alert_whatsapp = '+919876543210', staff_ip_allowlist = '{203.0.113.0/24}'
where venue_id = '00000000-0000-4000-8000-000000000001';
select results_eq($$ select alert_whatsapp, staff_ip_allowlist::text[] from public.venue_config_detail where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values ('+919876543210'::text, array['203.0.113.0/24']) $$, 'a super admin sets the alert number and the IP allowlist');
select lives_ok($$ insert into public.chip_denomination (venue_id, value_paise, name) values ('00000000-0000-4000-8000-000000000001', 200000, '₹2,000') $$,
  'adds a ₹2,000 chip');
select results_eq($$ update public.chip_denomination set is_active = false
                     where venue_id = '00000000-0000-4000-8000-000000000001' and value_paise = 200000 returning is_active $$,
  $$ values (false) $$, 'and takes it out of use');
select throws_ok($$ insert into public.chip_denomination (venue_id, value_paise, name) values ('00000000-0000-4000-8000-000000000001', 7500, '₹75') $$,
  '23514', null, 'but never a chip that is not a multiple of ₹50');

-- Leela, a super admin at the club only, changes nothing at the practice venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000154');
select throws_ok($$ insert into public.chip_denomination (venue_id, value_paise, name) values ('00000000-0000-4000-8000-000000000002', 200000, '₹2,000') $$,
  '42501', null, 'a super admin at one venue adds no chip at another');
select is_empty($$ update public.venue_config set alert_whatsapp = '+919876543210' where venue_id = '00000000-0000-4000-8000-000000000002' returning venue_id $$,
  'nor changes its configuration');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');

-- Every change is in the audit log, with who made it.
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq($$ select action, entity from public.audit_log
                     where venue_id = '00000000-0000-4000-8000-000000000001' and entity in ('setting', 'venue_config', 'chip_denomination')
                       and actor_user_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000103')
                     order by id $$,
  $$ values ('insert', 'setting'), ('insert', 'setting'), ('insert', 'setting'), ('delete', 'setting'), ('update', 'venue_config'),
            ('insert', 'chip_denomination'), ('update', 'chip_denomination') $$,
  'each change is audited: three settings, a withdrawal, the configuration and the chip, and not the refused ones');

select * from finish();
rollback;
