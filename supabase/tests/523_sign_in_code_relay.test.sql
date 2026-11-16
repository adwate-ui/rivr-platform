-- Sign-in codes by VerifyNow (decision 0679): Auth's code is kept with VerifyNow's check, tried at
-- most five times within ten minutes, given back for the code VerifyNow accepted (again for two
-- minutes), kept encrypted under a keyed hash of the number; one address may check 30 times in five
-- minutes; only the service role may keep, try or take a code.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- An address of its own for each part, so the address limit is met only where it is tested.
set local role service_role;
select is(public.keep_sign_in_code('+919000000201', '1357924680', 'v1'), true, 'the hook keeps Auth''s code with VerifyNow''s check');
select results_eq($$ select * from public.sign_in_code_attempt('+919000000201', '482913', '198.51.100.1') $$,
  $$ values ('v1'::text, null::text, null::text) $$, 'a try is checked against that check');
select is(public.take_sign_in_code('+919000000201', 'v0', '482913'), null, 'Auth''s code goes only with the check VerifyNow accepted');
select is(public.take_sign_in_code('+919000000201', 'v1', '482913'), '1357924680', 'once VerifyNow accepts the code, Auth''s comes back');
select is(public.take_sign_in_code('+919000000201', 'v1', '482913'), null, 'only once from VerifyNow''s acceptance');
select results_eq($$ select * from public.sign_in_code_attempt('+919000000201', '482913', '198.51.100.1') $$,
  $$ values (null::text, '1357924680'::text, null::text) $$, 'but the same code gets it again, should signing in with it fail');
select results_eq($$ select * from public.sign_in_code_attempt('+919000000201', '000000', '198.51.100.1') $$,
  $$ values (null::text, null::text, null::text) $$, 'and another code gets nothing');
select is(public.keep_sign_in_code('+919000000201', '2468013579', null), false, 'nor does a new code join an accepted check');
reset role;
update private.sign_in_code_relay set taken_at = now() - interval '3 minutes';
set local role service_role;
select results_eq($$ select * from public.sign_in_code_attempt('+919000000201', '482913', '198.51.100.1') $$,
  $$ values (null::text, null::text, null::text) $$, 'after two minutes even the accepted code gets nothing');

select is(public.keep_sign_in_code('+919000000202', '1111111111', null), false,
  'with no check of its own, a code is kept only with VerifyNow''s last check for the number');
select is(public.keep_sign_in_code('+919000000202', '1111111111', 'v2'), true, 'a first code to the number');
select is(public.keep_sign_in_code('+919000000202', '2222222222', null), true, 'a second, while VerifyNow''s first code stands');
select is((select verification_id from public.sign_in_code_attempt('+919000000202', '482913', '198.51.100.2')), 'v2', 'goes with the first check');
select is(public.take_sign_in_code('+919000000202', 'v2', '482913'), '2222222222', 'and Auth''s newer code replaces its older one');
reset role;

select is_empty($$ select * from private.sign_in_code_relay where phone_hash like '%9000000201%' or phone_hash like '%9000000202%' $$,
  'the number is never stored, only a keyed hash');
select is_empty($$ select * from private.sign_in_code_relay where accepted_hash = '482913' $$, 'nor the accepted code');

set local role service_role;
select is(public.keep_sign_in_code('+919000000203', '3333333333', 'v3'), true, 'a code for a third number');
reset role;
select is_empty($$ select * from private.sign_in_code_relay where position(convert_to('3333333333', 'UTF8') in code_secret) > 0 $$,
  'is never kept in the clear');

set local role service_role;
select is((select verification_id from public.sign_in_code_attempt('+919000000203', '000001', '198.51.100.3')), 'v3', 'try 1');
select is((select verification_id from public.sign_in_code_attempt('+919000000203', '000002', '198.51.100.3')), 'v3', 'try 2');
select is((select verification_id from public.sign_in_code_attempt('+919000000203', '000003', '198.51.100.3')), 'v3', 'try 3');
select is((select verification_id from public.sign_in_code_attempt('+919000000203', '000004', '198.51.100.3')), 'v3', 'try 4');
select is((select verification_id from public.sign_in_code_attempt('+919000000203', '000005', '198.51.100.3')), 'v3', 'try 5');
select is((select verification_id from public.sign_in_code_attempt('+919000000203', '000006', '198.51.100.3')), null, 'a sixth try finds no check');
select is(public.take_sign_in_code('+919000000203', 'v3', '000006'), null, 'and nothing to give back: the code went with the tries');
select is(public.keep_sign_in_code('+919000000203', '4444444444', null), false, 'nor can a new code join the spent check');

select is(public.keep_sign_in_code('+919000000204', '5555555555', 'v4'), true, 'a code for a fourth number');
reset role;
update private.sign_in_code_relay set sent_at = now() - interval '11 minutes';
set local role service_role;
select is(public.take_sign_in_code('+919000000204', 'v4', '482913'), null, 'is not given back after ten minutes');
select is((select verification_id from public.sign_in_code_attempt('+919000000204', '482913', '198.51.100.4')), null, 'nor tried');

select is(public.keep_sign_in_code('+919000000205', '6666666666', 'v5'), true, 'a code for a fifth number');
reset role;
update private.sign_in_code_relay set sent_at = now() - interval '2 hours';
set local role service_role;
select lives_ok($$ select public.keep_sign_in_code('+919000000206', '7777777777', 'v6') $$, 'keeping another code');
reset role;
select is((select count(*)::int from private.sign_in_code_relay), 1, 'drops rows over an hour old');
select ok(exists (select 1 from private.sign_in_code_send s where s.phone_hash = private.sign_in_hash('+919000000206') and s.sent_at > now() - interval '1 minute'),
  'and every code kept is noted as sent, for the hourly limit''s alert');

-- The address limit.
set local role service_role;
select is(public.keep_sign_in_code('+919000000207', '8888888888', 'v7'), true, 'a code for a seventh number');
reset role;
insert into private.sign_in_check (client) select private.sign_in_hash('203.0.113.9') from generate_series(1, 30);
set local role service_role;
select results_eq($$ select * from public.sign_in_code_attempt('+919000000207', '482913', '203.0.113.9') $$,
  $$ values (null::text, null::text, 'too_many'::text) $$, 'an address that checked 30 times in five minutes is refused');
select results_eq($$ select * from public.sign_in_code_attempt('+919000000207', '482913', '::ffff:203.0.113.9') $$,
  $$ values (null::text, null::text, 'too_many'::text) $$, 'written the IPv6 way too');
reset role;
select is((select tries::int from private.sign_in_code_relay where verification_id = 'v7'), 0, 'without using up the number''s tries');
select is((select count(*)::int from public.alert where kind = 'auth.sign_in_guessed'), 1, 'and the owner is alerted');
set local role service_role;
select is((select verification_id from public.sign_in_code_attempt('+919000000207', '482913', '203.0.113.10')), 'v7', 'another address still checks');
reset role;
update private.sign_in_check set checked_at = now() - interval '6 minutes' where client = private.sign_in_hash('203.0.113.9');
select is_empty($$ select * from private.sign_in_check where client like '%203.0.113%' $$, 'the address is never stored, only a keyed hash');
set local role service_role;
select is((select verification_id from public.sign_in_code_attempt('+919000000207', '482913', '203.0.113.9')), 'v7', 'and the first again after five minutes');
reset role;
select is((select count(*)::int from public.alert where kind = 'auth.sign_in_guessed'), 1, 'one alert, not one per refusal');

select ok((select relrowsecurity from pg_class where oid = 'private.sign_in_code_relay'::regclass), 'the codes have row-level security on');
select ok((select relrowsecurity from pg_class where oid = 'private.sign_in_check'::regclass), 'and the checks');
set local role service_role;
select throws_ok($$ select * from private.sign_in_code_relay $$, '42501', null, 'which even the service role reads only through the functions');
select throws_ok($$ select * from private.sign_in_check $$, '42501', null, 'both');
select throws_ok($$ select private.sign_in_code_key() $$, '42501', null, 'nor may it read the key');
reset role;

set local role anon;
select throws_ok($$ select public.keep_sign_in_code('+919000000201', '1357924680', 'v1') $$, '42501', null, 'a visitor keeps no code');
select throws_ok($$ select * from public.sign_in_code_attempt('+919000000201', '482913', '198.51.100.1') $$, '42501', null, 'tries none');
select throws_ok($$ select public.take_sign_in_code('+919000000201', 'v1', '482913') $$, '42501', null, 'and takes none');
set local role authenticated;
select throws_ok($$ select public.take_sign_in_code('+919000000201', 'v1', '482913') $$, '42501', null, 'nor does anyone signed in');
reset role;

select * from finish();
rollback;
