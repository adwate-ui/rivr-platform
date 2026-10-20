-- The cage and a member's identity (#58, decision 0065). 204 Rohan's check shows him under 18; 203
-- Naina's was refused for the PAN of 211 Ishaan, a verified member. 104 is a cashier with markers; 201
-- Arjun has finished his check and has a KYC photo; 103 runs the door; 213 Mihir takes a break.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at, refusal) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 'verified', 'digilocker', current_date - interval '17 years',
   'ABCPB2044C', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000204/selfie.jpg', now(), null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'refused', 'digilocker', '1990-01-01',
   'ABCPV2111K', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/selfie.jpg', null, 'duplicate_pan');

-- The cage's search says why.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select full_name, is_kyc_complete, kyc_refusal from public.cage_members('00000000-0000-4000-8000-000000000001', 'Rohan') $$,
  $$ values ('Rohan Bhatia'::text, false, 'under_18'::text) $$, 'Rohan''s check fails: under 18');
select results_eq($$ select full_name, kyc_refusal from public.cage_members('00000000-0000-4000-8000-000000000001', 'Naina') $$,
  $$ values ('Naina Kapoor'::text, 'duplicate_pan'::text) $$, 'Naina''s: the PAN of a verified member');
select results_eq($$ select full_name, is_kyc_complete, kyc_refusal from public.cage_members('00000000-0000-4000-8000-000000000001', 'Arjun') $$,
  $$ values ('Arjun Mehta'::text, true, null::text) $$, 'Arjun''s is complete');

-- Buy-in, marker and cash-out refuse with the reason.
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 1000000, 'cash', gen_random_uuid()) $$,
  'RVAGE', null, 'no chips for someone under 18');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 1000000, 'cash', gen_random_uuid()) $$,
  'RVDUP', null, 'nor for the identity of another verified member');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 1000000, 'cash', gen_random_uuid()) $$,
  'RVKYC', null, 'nor for a check not finished');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 1000000,
  'M10 40 C 30 10, 50 70, 70 40', gen_random_uuid()) $$, 'RVAGE', null, 'no marker for someone under 18');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 1000000,
  'M10 40 C 30 10, 50 70, 70 40', gen_random_uuid()) $$, 'RVDUP', null, 'nor for a duplicate');
select throws_ok($$ select * from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 1000000, 'cash',
  gen_random_uuid(), false) $$, 'RVAGE', null, 'no cash-out for someone under 18');
select throws_ok($$ select * from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 1000000, 'cash',
  gen_random_uuid(), false) $$, 'RVDUP', null, 'nor for a duplicate');
reset role;

-- A member on a break gets no marker, but cashes out the chips they hold (decision 0065, question #364).
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000213'), null, 'Mihir checks in');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select isnt(public.take_break(7), null, 'and takes a 7-day break');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 1000000,
  'M10 40 C 30 10, 50 70, 70 40', gen_random_uuid()) $$, 'RVBRK', null, 'no marker during a break');
select is((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
  1000000, 'cash', gen_random_uuid(), false)), 1000000::bigint, 'but his chips cash out');
reset role;

-- A frozen member is refused before anything else, as before.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000204', 'Dispute');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.cage_buy_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 1000000, 'cash', gen_random_uuid()) $$,
  'RVMBR', null, 'a frozen member is refused as frozen');
select throws_ok($$ select public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 1000000,
  'M10 40 C 30 10, 50 70, 70 40', gen_random_uuid()) $$, 'RVMBR', null, 'and gets no marker');
select throws_ok($$ select * from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204', 1000000, 'cash',
  gen_random_uuid(), false) $$, 'RVMBR', null, 'nor a cash-out');
reset role;

-- The cage's withdrawals and deposits come with the member's KYC photo.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select public.request_withdrawal(500000, (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000201'), gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select full_name, photo_path from public.waiting_withdrawals('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Arjun Mehta'::text, '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/selfie.jpg'::text) $$,
  'a withdrawal shows Arjun''s KYC photo');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select public.request_deposit(100000, '912345678911', (select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000212'), gen_random_uuid());
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select full_name, photo_path from public.waiting_deposits('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Vihaan Kapoor'::text, '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000212/selfie.jpg'::text) $$,
  'and a deposit Vihaan''s');
reset role;

select * from finish();
rollback;
