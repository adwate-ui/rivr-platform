-- Points by hand (#645): staff who keep the rewards (rewards.manage: 101 Vikram) give 213 Mihir points earned and locked,
-- unlock some, and his earned points alone are his to spend. A host (111 Zoya) gives none; another venue's admin nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- What Mihir holds before, from the seed.
create temp table before as
select (private.points_held('00000000-0000-4000-8000-000000000213')).o_earned as earned, (private.points_held('00000000-0000-4000-8000-000000000213')).o_locked as locked;
grant select on before to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000213', 500, false, 'Welcome back', '00000000-0000-4000-8000-00000000c645'), null,
  'the super admin gives Mihir 500 earned points');
select is(public.grant_points('00000000-0000-4000-8000-000000000213', 500, false, 'Welcome back', '00000000-0000-4000-8000-00000000c645'),
  public.grant_points('00000000-0000-4000-8000-000000000213', 500, false, 'Welcome back', '00000000-0000-4000-8000-00000000c645'), 'once per request id');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000213', 1000, true, 'Locked until his tenth visit', '00000000-0000-4000-8000-00000000c646'),
  null, 'and 1,000 locked');
select results_eq($$ select earned - (select earned from before), locked - (select locked from before)
                     from public.member_points('00000000-0000-4000-8000-000000000001', '90000 00213') $$,
  $$ values (500::bigint, 1000::bigint) $$, 'he holds 500 more earned and 1,000 more locked');
select lives_ok($$ select public.unlock_points('00000000-0000-4000-8000-000000000213', 400, 'Tenth visit', '00000000-0000-4000-8000-00000000c647') $$,
  'unlocking 400');
select results_eq($$ select earned - (select earned from before), locked - (select locked from before)
                     from public.member_points('00000000-0000-4000-8000-000000000001', '9000000213') $$,
  $$ values (900::bigint, 600::bigint) $$, 'moves them to earned');
select throws_ok($$ select public.unlock_points('00000000-0000-4000-8000-000000000213', 1000000, 'Too many', gen_random_uuid()) $$, 'RVPTS', null,
  'never more than he holds locked');
select throws_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000213', 0, false, 'None', gen_random_uuid()) $$, '22023', null,
  'points are 1 or more');
select throws_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000213', 10, false, 'x', gen_random_uuid()) $$, '22023', null,
  'with a reason');
reset role;

-- Rewards spend earned points only.
select is((select -private.account_balance(a.id) from public.ledger_account a
           where a.member_id = '00000000-0000-4000-8000-000000000213' and a.code = 'member.points') - (select earned from before), 900::bigint,
  'a redemption spends from his earned points, the 900');
select throws_ok($$ select private.debit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
                    (select earned from before) + 901, 'Too dear', 'test:dear') $$, 'RVPTS', null, 'and never from the 600 locked');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is(public.my_locked_points() - (select locked from before), 600::bigint, 'Mihir sees his 600 locked points');
select pg_temp.as_person('00000000-0000-4000-8000-000000000111');
select throws_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000213', 10, false, 'From the host', gen_random_uuid()) $$, '42501', null,
  'a host gives no points');
select is((select count(*)::integer from public.member_points('00000000-0000-4000-8000-000000000001', '9000000213')), 0, 'nor reads them');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000213', 10, false, 'From elsewhere', gen_random_uuid()) $$, '42501', null,
  'another venue''s admin gives none here');
reset role;

select is(has_function_privilege('anon', 'public.grant_points(uuid, bigint, boolean, text, uuid)', 'execute'), false, 'nobody signed out gives points');

-- Each change is a business event, and marketing, who keeps the catalogue, gives no points.
select ok(exists (select 1 from public.outbox_event where event_type = 'points.locked' and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000213')
          and exists (select 1 from public.outbox_event where event_type = 'points.released' and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000213'),
  'locking and releasing points each tell the rest of the system');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000213', 10, false, 'From marketing', gen_random_uuid()) $$, '42501', null,
  'marketing gives no points');
reset role;
-- Nobody gives themselves points: a super admin who is also a member here.
update public.member set user_id = '00000000-0000-4000-8000-000000000101' where id = '00000000-0000-4000-8000-000000000216';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000216', 10, false, 'For myself', gen_random_uuid()) $$, '42501', null,
  'nobody gives themselves points');
reset role;

-- One request id is one change: the same id for earned points then locked ones gives each, under keys of their own.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
create temp table one_id as select gen_random_uuid() as id;
grant select on one_id to authenticated;
select lives_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000213', 5, false, 'Same id, earned', (select id from one_id)) $$, 'earned');
select lives_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000213', 5, true, 'Same id, locked', (select id from one_id)) $$, 'and locked');
reset role;

-- Erasure forfeits his locked points with the earned ones, back to the points issued, and the ledger stays balanced.
create temp table forfeit as
select private.forfeit_member_rewards(m) as summary, (private.points_held(m.id)).o_earned as earned, (private.points_held(m.id)).o_locked as locked
from public.member m where m.id = '00000000-0000-4000-8000-000000000213';
select ok((select (summary ->> 'points')::bigint = earned + locked from forfeit), 'the forfeit counts the earned and the locked points');
select results_eq($$ select o_earned, o_locked from private.points_held('00000000-0000-4000-8000-000000000213') $$, $$ values (0::bigint, 0::bigint) $$,
  'and leaves him neither');
select is((select sum(l.amount) from public.ledger_entry l join public.ledger_transaction t on t.id = l.transaction_id
           where t.idempotency_key = 'member_erasure_forfeit:points_locked:00000000-0000-4000-8000-000000000213'), 0::numeric,
  'the locked points'' forfeit balances');

select * from finish();
rollback;
