-- Rate limits on staff calls (decision 0199). 104 is a cashier, 105 another staff member. A
-- staff member's calls of one kind are limited per minute, and so are the venue's: the call that reaches a limit
-- goes through and alerts (once in 15 minutes), the next is refused with RVRAT. Nobody signed in can call the
-- mechanism or read its hits. The cage's rows it was first written for went on 15 Nov.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_staff(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

select pg_temp.as_staff('00000000-0000-4000-8000-000000000104');
select lives_ok($$ select private.assert_rate('00000000-0000-4000-8000-000000000001', 'test.call', 2, 10) $$, 'a first call goes through');
select is((select count(*)::integer from public.alert where kind = 'cage.rate_limit'), 0, 'with no alert');
select lives_ok($$ select private.assert_rate('00000000-0000-4000-8000-000000000001', 'test.call', 2, 10) $$,
  'the call that reaches the limit goes through');
select results_eq($$ select detail ->> 'action', detail ->> 'limit' from public.alert where kind = 'cage.rate_limit' $$,
  $$ values ('test.call'::text, 'staff'::text) $$, 'and alerts the owner which limit was reached');
select throws_ok($$ select private.assert_rate('00000000-0000-4000-8000-000000000001', 'test.call', 2, 10) $$, 'RVRAT', null,
  'the next is refused');
select lives_ok($$ select private.assert_rate('00000000-0000-4000-8000-000000000001', 'other.call', 2, 10) $$, 'another kind of call is counted apart');

-- The venue's limit: another staff member's calls count towards it, and reaching it alerts once only.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000105');
delete from public.alert where kind = 'cage.rate_limit';
select lives_ok($$ select private.assert_rate('00000000-0000-4000-8000-000000000001', 'test.call', 5, 3) $$,
  'another staff member has their own limit, and reaches the venue''s');
select results_eq($$ select detail ->> 'limit' from public.alert where kind = 'cage.rate_limit' $$, $$ values ('venue'::text) $$,
  'which alerts as the venue''s');
select throws_ok($$ select private.assert_rate('00000000-0000-4000-8000-000000000001', 'test.call', 5, 3) $$, 'RVRAT', null,
  'past it, every call is refused');
update private.rate_hit set at = at - interval '2 minutes';
select lives_ok($$ select private.assert_rate('00000000-0000-4000-8000-000000000001', 'test.call', 5, 1) $$,
  'calls older than a minute do not count, and reaching the limit again');
select is((select count(*)::integer from public.alert where kind = 'cage.rate_limit'), 1, 'alerts no more than once in 15 minutes');

select ok(not has_function_privilege('authenticated', 'private.assert_rate(uuid, text, integer, integer)', 'execute'),
  'nobody signed in can spend the venue''s calls');
select ok(not has_table_privilege('authenticated', 'private.rate_hit', 'select'), 'or read who made which call');

select * from finish();
rollback;
