-- Credit lines (#73; decision 0058). Kunal Mehra (216) has finished his identity check and been in
-- three times (seed); Ishaan (211) has finished his check but never visited; Rohan (204) has not
-- finished his. The club's rules (seed): raises above ₹1,00,000 wait for a super admin, three visits,
-- a ₹25,00,000 room cap. 103 Aditya is a floor manager (markers.manage_limits); 101 and 130 are super
-- admins; 104 a cashier; 106 a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.line() returns public.credit_line language sql as $$
  select * from public.credit_line where member_id = '00000000-0000-4000-8000-000000000216';
$$;
create function pg_temp.staff(p_person text) returns uuid language sql as $$
  select id from public.staff where user_id = p_person::uuid and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.as_person(text), pg_temp.line(), pg_temp.staff(text) to authenticated;

-- Within the threshold, in force at once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 5000000, 'A regular'), 'active',
  'the floor manager gives Kunal ₹50,000 of credit');
select results_eq($$ select full_name, limit_paise, proposed_limit_paise from public.credit_lines('00000000-0000-4000-8000-000000000001') where full_name = 'Kunal Mehra' $$,
  $$ values ('Kunal Mehra'::text, 5000000::bigint, null::bigint) $$, 'in force at once');

-- A raise above it waits for a super admin, who approves the amount they saw.
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 20000000, 'Plays 100/200 weekly'), 'needs_approval',
  '₹2,00,000 is above the threshold');
select results_eq($$ select limit_paise, proposed_limit_paise, proposed_by from public.credit_lines('00000000-0000-4000-8000-000000000001') where full_name = 'Kunal Mehra' $$,
  $$ values (5000000::bigint, 20000000::bigint, 'Aditya Malhotra'::text) $$, 'it waits beside the ₹50,000 in force');
select throws_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 20000000) $$, '42501', null, 'the floor manager cannot approve it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 15000000) $$, 'RVSTL', null,
  'nor does a super admin approve an amount other than the one waiting');
select lives_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 20000000) $$, 'a super admin approves it');
reset role;
select results_eq($$ select limit_paise, proposed_limit_paise, approved_by_staff_id, set_by_staff_id from public.credit_line
                     where member_id = '00000000-0000-4000-8000-000000000216' $$,
  $$ values (20000000::bigint, null::bigint, pg_temp.staff('00000000-0000-4000-8000-000000000101'), pg_temp.staff('00000000-0000-4000-8000-000000000103')) $$,
  '₹2,00,000 is in force, set by Aditya and approved by the super admin');

-- A super admin's own raise waits for another; a cut is in force at once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 30000000, 'Owner''s call'), 'needs_approval',
  'a super admin''s own raise above the threshold waits too');
select throws_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 30000000) $$, '22023', null, 'and they cannot approve it themselves');
select pg_temp.as_person('00000000-0000-4000-8000-000000000130');
select lives_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 30000000) $$, 'another super admin does');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 40000000, 'More'), 'needs_approval', 'another raise waits');
select pg_temp.as_person('00000000-0000-4000-8000-000000000130');
select lives_ok($$ select public.decide_credit_limit((pg_temp.line()).id, false, 40000000) $$, 'and is declined');
select throws_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 40000000) $$, '22023', null, 'so nothing waits to approve');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 25000000, 'Trim'), 'active',
  'a cut from ₹3,00,000 to ₹2,50,000 is in force at once');
reset role;
select is((pg_temp.line()).limit_paise, 25000000::bigint, '₹2,50,000 in force');

-- A super admin without access now approves nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 35000000, 'Again'), 'needs_approval', 'a raise waits');
reset role;
insert into public.control_state (venue_id, level, staff_id, reason, engaged_by_staff_id)
values ('00000000-0000-4000-8000-000000000001', 'access_revoke', pg_temp.staff('00000000-0000-4000-8000-000000000130'), 'Left',
        pg_temp.staff('00000000-0000-4000-8000-000000000101'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000130');
select throws_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 35000000) $$, '42501', null,
  'a super admin whose access is revoked approves nothing');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 35000000) $$, '42501', null,
  'nor does one no longer active at the club, though still staff at the practice venue');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001';

-- What is refused.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 5000020, 'Odd') $$, 'RVCHP', null,
  'a limit is whole ₹50 chips');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000204', 5000000, 'New') $$, 'RVKYC', null,
  'no credit before the identity check is finished');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000211', 5000000, 'New') $$, 'RVVIS', null,
  'nor before three visits');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000999', 5000000, 'Who') $$, 'RVNOM', null,
  'nor for a number no member has');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 5000000, ' ') $$, '22023', null,
  'nor without a reason');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 5000000, 'Cashier') $$, '42501', null,
  'a cashier sets no limits');

-- Room exposure: every member's open markers against the cap. Arjun's ₹50,000 marker is open (seed).
reset role;
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'deposit', 'test-marker',
  jsonb_build_array(jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000216' and code = 'member.receivable'), 'amount', '1000000'),
                    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.chips_outstanding' and member_id is null), 'amount', '-1000000')), null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select exposure_paise, exposure_cap_paise, approval_threshold_paise, minimum_visits from public.credit_room('00000000-0000-4000-8000-000000000001') $$,
  $$ values (6000000::bigint, 250000000::bigint, 10000000::bigint, 3) $$, 'Arjun''s ₹50,000 and Kunal''s ₹10,000 open across the room, against ₹25,00,000');
select is((select outstanding_paise from public.credit_lines('00000000-0000-4000-8000-000000000001') where full_name = 'Kunal Mehra'), 1000000::bigint, 'Kunal''s, on his line');

-- Who sees credit: staff who set limits, issue markers or read the ledger, at their venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.credit_line), 2, 'a cashier sees the credit lines, Kunal''s and Arjun''s (seed)');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select id from public.credit_line $$, 'a dealer does not');
select is_empty($$ select * from public.credit_lines('00000000-0000-4000-8000-000000000001') $$, 'nor through the screen''s read');
select is_empty($$ select * from public.credit_room('00000000-0000-4000-8000-000000000001') $$, 'nor the room''s exposure');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select id from public.credit_line $$, 'nor does Kunal read the line itself');
reset role;
update public.staff set is_active = false where user_id in ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104')
  and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select id from public.credit_line $$, 'the practice venue''s cashier sees no club line');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 5000000, 'Other venue') $$, '42501', null,
  'and its floor manager sets no club limits');
reset role;
update public.staff set is_active = true where user_id in ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104')
  and venue_id = '00000000-0000-4000-8000-000000000001';

-- Closing a line; a frozen member; credit switched off; a frozen venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 0, 'Closed at his request'), 'active', 'a line closes at once');
select is_empty($$ select * from public.credit_lines('00000000-0000-4000-8000-000000000001') where full_name = 'Kunal Mehra' $$, 'and leaves the list');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 20000000, 'Reopened'), 'needs_approval', 'a raise waits again');
reset role;
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000216', 'Dispute',
        pg_temp.staff('00000000-0000-4000-8000-000000000101'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 5000000, 'Again') $$, 'RVMBR', null,
  'a frozen member gets no credit');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 20000000) $$, 'RVMBR', null, 'nor is a limit of theirs approved');
reset role;
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'credit', 'Review', pg_temp.staff('00000000-0000-4000-8000-000000000101'));
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.decide_credit_limit((pg_temp.line()).id, true, 20000000) $$, 'RVKIL', null,
  'while credit is switched off no limit is approved');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000212', 5000000, 'New') $$, 'RVKIL', null,
  'nor set');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000212', 5000000, 'New') $$, 'RVFRZ', null,
  'and while the venue is frozen, none');
reset role;

-- A venue with no credit rules set has no credit (the practice venue's are removed here, by the database).
select set_config('request.jwt.claims', '', true);
delete from public.setting where venue_id = '00000000-0000-4000-8000-000000000002' and key = 'credit.config';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_credit_limit('00000000-0000-4000-8000-000000000002', '9000000301', 5000000, 'Trainee') $$, 'RVCFG', null,
  'a venue with no credit rules gives no credit');
select is_empty($$ select * from public.credit_room('00000000-0000-4000-8000-000000000002') $$, 'and shows no room exposure to set it against');
reset role;

select * from finish();
rollback;
