-- Rate limits on the cage's money calls (#342; decision 0199). 104 is a cashier, 105 another staff member. A
-- staff member's calls of one kind are limited per minute, and so are the venue's: the call that reaches a limit
-- goes through and alerts (once in 15 minutes), the next is refused with RVRAT. Buy-ins, cash-outs, marker
-- repayments and marker issues are limited where their rows are written; the database's own writes and the
-- practice venue's reset are not. Nobody signed in can call the mechanism or read its hits.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_staff(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.hits(p_actor uuid, p_action text, p_count integer) returns void language sql as $$
  insert into private.rate_hit (venue_id, actor, action)
  select '00000000-0000-4000-8000-000000000001', p_actor, p_action from generate_series(1, p_count);
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

-- Where the cage's rows are written: past 30 a minute a cashier is refused, before the row is even checked.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000104');
select pg_temp.hits('00000000-0000-4000-8000-000000000104', a, 30)
from unnest(array['cage.buy_in', 'cage.cash_out', 'cage.marker_repayment', 'marker.issue']) a;
select throws_ok($$ insert into public.cage_transaction (venue_id, kind) values ('00000000-0000-4000-8000-000000000001', 'buy_in') $$,
  'RVRAT', null, 'a buy-in past the limit is refused');
select throws_ok($$ insert into public.cage_transaction (venue_id, kind) values ('00000000-0000-4000-8000-000000000001', 'cash_out') $$,
  'RVRAT', null, 'a cash-out too');
select throws_ok($$ insert into public.cage_transaction (venue_id, kind) values ('00000000-0000-4000-8000-000000000001', 'marker_repayment') $$,
  'RVRAT', null, 'a marker repayment too');
select throws_ok($$ insert into public.marker (venue_id) values ('00000000-0000-4000-8000-000000000001') $$,
  'RVRAT', null, 'and a marker issue');
-- Under the limit the trigger lets the row through to its own checks.
select pg_temp.as_staff('00000000-0000-4000-8000-000000000105');
select throws_ok($$ insert into public.cage_transaction (venue_id, kind) values ('00000000-0000-4000-8000-000000000001', 'buy_in') $$,
  '23502', null, 'a staff member under the limit reaches the row''s own checks');

-- The venue's limit is full: with nobody signed in, or in the practice venue's reset, nothing is limited.
select pg_temp.hits('00000000-0000-4000-8000-000000000106', 'cage.buy_in', 120);
select set_config('request.jwt.claims', '', true);
select throws_ok($$ insert into public.cage_transaction (venue_id, kind) values ('00000000-0000-4000-8000-000000000001', 'buy_in') $$,
  '23502', null, 'the database''s own writes are not limited');
select pg_temp.as_staff('00000000-0000-4000-8000-000000000104');
select set_config('rivr.purge', 'on', true), set_config('rivr.purge_venue', '00000000-0000-4000-8000-000000000001', true);
select throws_ok($$ insert into public.cage_transaction (venue_id, kind) values ('00000000-0000-4000-8000-000000000001', 'buy_in') $$,
  '23502', null, 'nor the reload of a reset');
select set_config('rivr.purge', 'off', true);

select ok(not has_function_privilege('authenticated', 'private.assert_rate(uuid, text, integer, integer)', 'execute'),
  'nobody signed in can spend the venue''s calls');
select ok(not has_table_privilege('authenticated', 'private.rate_hit', 'select'), 'or read who made which call');

select * from finish();
rollback;
