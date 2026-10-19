-- Sign-in code sends (#181): a second code to a number within ten minutes is known as a repeat; the
-- table holds a keyed hash and a time, never the number; only the service role may note a send.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

set local role service_role;
select is(public.note_sign_in_code_send('+919000000201'), false, 'the first code to a number is not a repeat');
select is(public.note_sign_in_code_send('+919000000201'), true, 'a second within ten minutes is');
select is(public.note_sign_in_code_send('+919000000202'), false, 'another number is its own');
reset role;

select is((select count(*)::int from private.sign_in_code_send), 2, 'one row per number');
select ok((select relrowsecurity from pg_class where oid = 'private.sign_in_code_send'::regclass), 'with row-level security on');
set local role service_role;
select throws_ok($$ select * from private.sign_in_code_send $$, '42501', null, 'which even the service role reads only through the function');
reset role;
select is_empty($$ select * from private.sign_in_code_send where phone_hash like '%9000000201%' $$,
  'the number is never stored, only a keyed hash');
update private.sign_in_code_send set sent_at = now() - interval '11 minutes';
set local role service_role;
select is(public.note_sign_in_code_send('+919000000201'), false, 'after ten minutes a code is a first again');
reset role;
update private.sign_in_code_send set sent_at = now() - interval '2 days';
set local role service_role;
select lives_ok($$ select public.note_sign_in_code_send('+919000000203') $$, 'noting a send');
reset role;
select is((select count(*)::int from private.sign_in_code_send), 1, 'drops rows older than a day');

set local role anon;
select throws_ok($$ select public.note_sign_in_code_send('+919000000201') $$, '42501', null, 'a visitor notes nothing');
set local role authenticated;
select throws_ok($$ select public.note_sign_in_code_send('+919000000201') $$, '42501', null, 'nor anyone signed in');
reset role;

select * from finish();
rollback;
