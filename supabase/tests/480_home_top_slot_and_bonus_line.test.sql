-- Player Home and Bonus (redesign RD-20): a notice in force comes with when it started, newest first, so Home shows the
-- one that started last; and a member's balance comes with the days Bonus lasts at their venue, as "Bonus expires" is in
-- force. 201 Arjun is a member of RIVR; Elsewhere's member reads neither RIVR's notices nor its setting.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.expiry(p_days integer, p_from timestamptz) returns void language sql as $$
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'bonus.expiry_days', '', jsonb_build_object('days', p_days), p_from, 'Test 480');
$$;

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e3', 'authenticated', 'authenticated', '919000000997', now(), now());
insert into public.member (venue_id, user_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e3', 'Elsewhere Member', '+919000000997');

-- Three notices at RIVR: two in force, one still to come, one ended; and one in force at Elsewhere.
delete from public.notice;
insert into public.notice (venue_id, body, starts_at, ends_at) values
  ('00000000-0000-4000-8000-000000000001', 'Kitchen closes at 1 tonight.', now() - interval '3 hours', null),
  ('00000000-0000-4000-8000-000000000001', 'Table 4 opens at 9 tonight.', now() - interval '1 hour', now() + interval '2 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Valet from tomorrow.', now() + interval '1 day', null),
  ('00000000-0000-4000-8000-000000000001', 'Doors at 6.', now() - interval '2 days', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000000e1', 'Elsewhere is open.', now() - interval '5 minutes', null);

select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select body, starts_at from public.my_notices() $$,
  $$ values ('Table 4 opens at 9 tonight.'::text, now() - interval '1 hour'), ('Kitchen closes at 1 tonight.'::text, now() - interval '3 hours') $$,
  'Arjun reads the notices in force with when each started, the one that started last first');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e3');
select results_eq($$ select body from public.my_notices() $$, $$ values ('Elsewhere is open.'::text) $$, 'another club''s member reads only their own');
select throws_ok($$ set local role anon; select * from public.my_notices() $$, '42501', null, 'nobody signed out reads notices');

-- The balance's line: the days Bonus lasts, as the setting is in force.
reset role;
select set_config('request.jwt.claims', '', true);
delete from public.setting where key = 'bonus.expiry_days';
create temp table held as
  select private.bonus_in_force(m.id, now()) as paise from public.member m where m.user_id = '00000000-0000-4000-8000-000000000201';
grant select on held to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select bonus_paise, expiry_days from public.my_bonus() $$, $$ select paise, null::integer from held $$,
  'with none set, the balance comes with no days: Bonus never expires');
reset role;
select set_config('request.jwt.claims', '', true);
select pg_temp.expiry(30, now() - interval '1 day');
select pg_temp.expiry(45, now() + interval '1 day');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select expiry_days from public.my_bonus()), 30, 'set to 30 days, it comes with 30: the value in force, not the change to come');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e3');
select is((select expiry_days from public.my_bonus()), null, 'another club''s member is not told RIVR''s setting');
reset role;
select set_config('request.jwt.claims', '', true);
select pg_temp.expiry(0, now() - interval '1 hour');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select expiry_days from public.my_bonus()), 0, 'switched off again, it comes with 0, which is never');
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select is_empty($$ select * from public.my_bonus() $$, 'someone who is no member has no balance');
select throws_ok($$ set local role anon; select * from public.my_bonus() $$, '42501', null, 'nobody signed out reads a balance');

select * from finish();
rollback;
