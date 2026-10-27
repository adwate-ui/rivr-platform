-- A member's phone number is changed by a super admin, never by the member (#502; decision 0248). Vikram (101) is a
-- super admin; Aditya (103) an admin. Mihir (213) lost his phone and has a new number; Yash (214) is another member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select is((select u.phone from auth.users u join public.member m on m.user_id = u.id where m.id = '00000000-0000-4000-8000-000000000213'),
  substr((select phone from public.member where id = '00000000-0000-4000-8000-000000000213'), 2), 'Mihir signs in with the number on his record');

-- An admin may not; a super admin may, with a reason and a real number, not one another member holds.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345678', 'Lost his phone') $$, '42501', null,
  'an admin does not change a member''s number');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '9812345678', 'Lost his phone') $$, '22023', null,
  'a number is +91 and ten digits');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345678', 'no') $$, '22023', null,
  'with a reason');
select throws_ok(format($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', %L, 'Lost his phone') $$,
                        (select phone from public.member where id = '00000000-0000-4000-8000-000000000214')), 'RVPHN', null,
  'not a number another member holds');
select lives_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345678', 'Lost his phone; new SIM') $$,
  'Vikram changes Mihir''s number');
reset role;

select is((select phone from public.member where id = '00000000-0000-4000-8000-000000000213'), '+919812345678', 'his record has the new number');
select results_eq(
  $$ select u.phone, u.phone_confirmed_at is not null, coalesce(u.phone_change, '') from auth.users u
     join public.member m on m.user_id = u.id where m.id = '00000000-0000-4000-8000-000000000213' $$,
  $$ values ('919812345678'::text, true, ''::text) $$, 'and his login: he signs in with the new number from now on');
select results_eq(
  $$ select action, reason from public.audit_log where entity = 'member' and entity_id = '00000000-0000-4000-8000-000000000213'
       and action = 'member.change_phone' $$,
  $$ values ('member.change_phone'::text, 'Lost his phone; new SIM'::text) $$, 'the change is in the audit log, with its reason');
select results_eq(
  $$ select detail from public.alert where kind = 'member.phone_changed' $$,
  $$ select jsonb_build_object('member_number', member_number) from public.member where id = '00000000-0000-4000-8000-000000000213' $$,
  'the owner is alerted, by member number, never the numbers themselves');

-- The same number again changes nothing; no one signed out or a member changes anyone's.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345678', 'Again') $$, 'the same number again');
reset role;
select is((select count(*)::integer from public.alert where kind = 'member.phone_changed'), 1, 'changes and alerts nothing more');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000214', '+919812345679', 'My new number') $$, '42501', null,
  'a member does not change their own number here either');
reset role;

select * from finish();
rollback;
