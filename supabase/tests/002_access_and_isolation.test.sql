-- Who sees which venue, staff and member rows, and who may change staff.
-- Seed people (supabase/seed/10_people.sql): 101 Vikram (super_admin), 103 Aditya (admin),
-- 104 Sana (cashier), 106 Pema (dealer), 109 Nikhil (owner_view), 201 Arjun (member).
-- Venues: ...0001 RIVR Gurugram, ...0002 the practice venue, plus an "Elsewhere" venue made here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A third venue with its own cashier and member, to prove nothing crosses venues.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Cashier', 'Cashier', 'cashier');
insert into public.member (venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000000e1', 'Elsewhere Member', '+919000000998');

-- Sana, a cashier at Gurugram and the practice venue.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';

select results_eq(
  $$ select slug from public.venue order by slug $$,
  $$ values ('gurugram'), ('practice') $$,
  'a cashier sees the venues she works at and no other'
);
select is((select count(*) from public.member where venue_id = '00000000-0000-4000-8000-0000000000e1')::int, 0,
  'a cashier sees no member of another venue');
select is((select count(*) from public.staff where venue_id = '00000000-0000-4000-8000-0000000000e1')::int, 0,
  'a cashier sees no staff of another venue');
select ok((select count(*) from public.member where venue_id = '00000000-0000-4000-8000-000000000001') = 8,
  'a cashier (members.read) sees her venue''s members');
select throws_ok(
  $$ select * from public.staff_credential $$, '42501', null,
  'no client can read dealer PIN hashes'
);
select throws_ok(
  $$ insert into public.staff (venue_id, full_name, job_title, role) values ('00000000-0000-4000-8000-000000000001', 'X', 'Cashier', 'cashier') $$,
  '42501', null,
  'a cashier cannot add staff'
);

-- Pema, a dealer: no member access.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000106", "role": "authenticated"}';
select is((select count(*) from public.member)::int, 0, 'a dealer sees no members');
select is((select count(*) from public.staff where venue_id = '00000000-0000-4000-8000-000000000001')::int, 18,
  'a dealer sees her colleagues');
select throws_ok($$ select bank_account_number from public.venue_config $$, '42501', null,
  'a dealer cannot read the bank details');
select is((select count(*) from public.venue_config)::int, 2, 'but reads what documents show');

-- Aditya, an admin (staff.manage, not venue.configure).
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.staff (venue_id, full_name, job_title, role) values ('00000000-0000-4000-8000-000000000001', 'New Host', 'Host', 'host') $$,
  'an admin adds a host, whose permissions she holds'
);
select throws_ok(
  $$ insert into public.staff (venue_id, full_name, job_title, role) values ('00000000-0000-4000-8000-000000000001', 'New Cashier', 'Cashier', 'cashier') $$,
  '42501', null,
  'an admin cannot add a cashier: the cage is a permission she does not hold'
);
select throws_ok(
  $$ insert into public.staff (venue_id, full_name, job_title, role) values ('00000000-0000-4000-8000-000000000001', 'Usurper', 'Owner', 'super_admin') $$,
  '42501', null,
  'an admin cannot create a super_admin'
);
select throws_ok(
  $$ update public.staff set role = 'super_admin' where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'an admin cannot promote anyone, herself included, to super_admin'
);
-- Row-level security makes these updates match no rows, so the values must be unchanged.
update public.staff set job_title = 'Changed' where role = 'super_admin';
select is((select count(*) from public.staff where role = 'super_admin' and job_title = 'Changed')::int, 0,
  'an admin cannot change a super_admin');
update public.venue_config set invoice_prefix = 'HACK' where venue_id = '00000000-0000-4000-8000-000000000001';
select is((select invoice_prefix from public.venue_config where venue_id = '00000000-0000-4000-8000-000000000001'), 'RIVR',
  'an admin cannot change the venue configuration');
select is((select count(*) from public.venue_config_detail)::int, 0, 'nor read its bank details and IP allowlist');

-- Nobody takes over a login by editing records: logins link only through link_my_login().
select throws_ok(
  $$ update public.member set user_id = '00000000-0000-4000-8000-000000000103' where id = '00000000-0000-4000-8000-000000000201' $$,
  '42501', null, 'an admin cannot point a member''s record at her own login');
select throws_ok(
  $$ update public.member set phone = '+919000000990' where id = '00000000-0000-4000-8000-000000000201' $$,
  '42501', null, 'staff cannot change the phone a member signs in with');
select throws_ok(
  $$ update public.staff set user_id = '00000000-0000-4000-8000-000000000103' where role = 'cashier' $$,
  '42501', null, 'an admin cannot point a staff record at her own login');
select throws_ok(
  $$ insert into public.device (venue_id, kind, name, auth_user_id)
     values ('00000000-0000-4000-8000-000000000001', 'cage', 'Cage 2', '00000000-0000-4000-8000-000000000103') $$,
  '42501', null, 'no client binds a device to a login');
select throws_ok(
  $$ insert into public.staff (venue_id, full_name, job_title, role, phone)
     values ('00000000-0000-4000-8000-000000000001', 'Second phone', 'Investor', 'owner_view', '+919000000990') $$,
  '42501', null, 'an admin cannot create a role holding a permission she lacks (owner_view reads the audit log)');

-- Vikram, a super_admin.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.staff (venue_id, full_name, job_title, role) values ('00000000-0000-4000-8000-000000000001', 'Partner', 'Owner', 'super_admin') $$,
  'a super_admin adds a super_admin'
);
update public.venue_config set invoice_prefix = 'RIVRG' where venue_id = '00000000-0000-4000-8000-000000000001';
select is((select invoice_prefix from public.venue_config where venue_id = '00000000-0000-4000-8000-000000000001'), 'RIVRG',
  'a super_admin changes the venue configuration');
select is((select count(*) from public.venue_config_detail)::int, 2, 'and reads all of it at both his venues');

-- Arjun, a member.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select results_eq($$ select slug from public.venue $$, $$ values ('gurugram') $$, 'a member sees only his venue');
select results_eq($$ select full_name from public.member $$, $$ values ('Arjun Mehta') $$, 'a member sees only himself');
select is((select count(*) from public.staff)::int, 0, 'a member sees no staff');
select is((select count(*) from public.venue_config)::int, 0, 'a member cannot read the venue configuration');

-- The public: only public_* views, never the practice venue.
reset role;
set local role anon;
select results_eq($$ select slug from public.public_venue order by slug $$, $$ values ('elsewhere'), ('gurugram') $$,
  'the public sees real venues, never the practice venue');
select throws_ok($$ select * from public.venue $$, '42501', null, 'the public cannot read the venue table');

-- Signing in: the session's token says how and when (amr). Called as the database owner, before
-- switching to the signed-in role.
reset role;
create function pg_temp.sign_in(p_user uuid, p_method text, p_at timestamptz)
returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', p_method, 'timestamp', extract(epoch from p_at)::bigint)))::text, true);
$$;

-- A cashier registered by phone links her login the first time she signs in with a code. Auth
-- creates her user with a confirmed phone and a random password, as it does for every code sign-in.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e3', 'authenticated', 'authenticated',
        '919000000997', now(), '$2a$10$abcdefghijklmnopqrstuuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY', now(), now());
insert into public.staff (venue_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-000000000001', 'Linked Cashier', 'Cashier', 'cashier', '+919000000997');
-- Another new hire's record. An attacker gets its phone onto their own login without a code: a
-- password sign-up, or a phone change, both of which Auth confirms when SMS confirmations are off.
insert into public.staff (venue_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-000000000001', 'Target Cashier', 'Cashier', 'cashier', '+919000000996');
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e4', 'authenticated', 'authenticated',
        '919000000996', now(), '$2a$10$abcdefghijklmnopqrstuuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY', now(), now());

select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e4', 'password', now());
set local role authenticated;
select public.link_my_login();
select is((select count(*) from public.staff)::int, 0, 'a password sign-in cannot claim a record by its phone');
reset role;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e4', 'otp', now() - interval '1 hour');
set local role authenticated;
select public.link_my_login();
select is((select count(*) from public.staff)::int, 0,
  'nor can a code sign-in to another number whose phone was switched afterwards');

reset role;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e3', 'otp', now());
set local role authenticated;
select is((select count(*) from public.staff)::int, 0, 'before linking, a new login is nobody');
select lives_ok($$ select public.link_my_login() $$, 'she signs in with a code and links her login');
select ok((select count(*) from public.staff where full_name = 'Linked Cashier') = 1, 'and is staff at her venue from then on');

-- The matrix itself refuses to give a super_admin-only permission to any other role.
reset role;
select throws_ok(
  $$ insert into public.role_permission (role, permission) values ('admin', 'purge.run') $$,
  '23514', null,
  'purge.run can never be granted to a role other than super_admin'
);

select * from finish();
rollback;
