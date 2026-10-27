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
select is(private.computer_kind_for('members.change_phone'), 'console'::public.device_kind, 'changing a number is admin-computer work');
-- Mihir is signed in on his lost phone.
insert into auth.sessions (id, user_id, created_at, updated_at)
select gen_random_uuid(), user_id, now(), now() from public.member where id = '00000000-0000-4000-8000-000000000213';

-- An admin may not; a super admin may, with a reason and a real number, not one another member holds.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345678', 'Lost his phone') $$, '42501', null,
  'an admin does not change a member''s number');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '9812345678', 'Lost his phone') $$, '22023', null,
  'a number is +91 and ten digits');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345678', 'no') $$, '22023', null,
  'with a reason');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345678', 'Mihir lost his phone') $$,
  '22023', null, 'a reason naming nothing of him, since the audit log keeps it');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345678', 'Old number 98123 45670 lost') $$,
  '22023', null, 'nor a phone number');
select throws_ok(format($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', %L, 'Lost his phone') $$,
                        (select phone from public.member where id = '00000000-0000-4000-8000-000000000214')), 'RVPHN', null,
  'not a number another member holds');
reset role;
-- Were Yash's login also a member of staff's, moving it would sign Vikram in as them.
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select venue_id, user_id, full_name, 'Dealer', 'dealer', phone from public.member where id = '00000000-0000-4000-8000-000000000214';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000214', '+919812345670', 'Lost his phone') $$, 'RVSTF', null,
  'not a login that is also staff''s');
reset role;
delete from public.staff where user_id = (select user_id from public.member where id = '00000000-0000-4000-8000-000000000214');
-- Nor a login that is a device's (#545).
insert into public.device (venue_id, kind, name, auth_user_id)
select venue_id, 'dealer_tablet', 'Test tablet', user_id from public.member where id = '00000000-0000-4000-8000-000000000214';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000214', '+919812345670', 'Lost his phone') $$, 'RVSTF', null,
  'not a login that is also a device''s');
reset role;
delete from public.device where auth_user_id = (select user_id from public.member where id = '00000000-0000-4000-8000-000000000214');
-- A login with no member row holds a number too.
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e9', 'authenticated', 'authenticated', '919812345611', now(), now());
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345611', 'Lost his phone') $$, 'RVPHN', null,
  'not a number a login with no member holds');
reset role;
-- An erased member's number is never changed.
create temp table erased as
  with made as (insert into public.member (venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000001', 'Gone Soon', '+919000000953') returning id)
  select id from made;
update public.member set erased_at = now(), phone = null, full_name = 'Erased member' where id = (select id from erased);
grant select on erased to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.change_member_phone((select id from erased), '+919812345612', 'Lost his phone') $$, 'RVERD', null,
  'not an erased member''s');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345678', 'Lost his phone; new SIM') $$,
  'Vikram changes Mihir''s number');
reset role;

select is((select phone from public.member where id = '00000000-0000-4000-8000-000000000213'), '+919812345678', 'his record has the new number');
select results_eq(
  $$ select u.phone, u.phone_confirmed_at is not null, coalesce(u.phone_change, '') from auth.users u
     join public.member m on m.user_id = u.id where m.id = '00000000-0000-4000-8000-000000000213' $$,
  $$ values ('919812345678'::text, true, ''::text) $$, 'and his login: he signs in with the new number from now on');
select is((select count(*)::integer from auth.sessions s join public.member m on m.user_id = s.user_id
           where m.id = '00000000-0000-4000-8000-000000000213'), 0, 'and the lost phone is signed out');
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

-- Ten changes in the hour, and no more (#545).
select private.audit('00000000-0000-4000-8000-000000000001', 'member.change_phone', 'member', g::text, null, null, 'Test') from generate_series(1, 9) g;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345613', 'Lost his phone') $$, 'RVRAT', null,
  'an eleventh change in the hour waits');
reset role;
-- A freeze is checked before the cap.
-- Nor while the member or the venue is frozen.
insert into public.control_state (venue_id, level, member_id, reason) values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000213', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000213', '+919812345613', 'Lost his phone') $$, 'RVMBR', null,
  'not a frozen member''s');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.change_member_phone('00000000-0000-4000-8000-000000000214', '+919812345614', 'Lost his phone') $$, 'RVFRZ', null,
  'nor in a frozen venue');
reset role;

select * from finish();
rollback;
