-- Bonus added by hand is capped by its setting (redesign RD-19; the owner, 15 Nov): bonus.by_hand_cap is the most one
-- addition may be for an admin or a floor manager; a super admin is not held to it; none set leaves 1,00,000. Only a super
-- admin changes it. 211 is the member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed has no one on the Floor role, so a host takes it here.
update public.staff s set role = 'floor'
where s.id = (select h.id from public.staff h where h.venue_id = '00000000-0000-4000-8000-000000000001' and h.role = 'host' and h.user_id is not null order by h.user_id limit 1);

-- The first staff member of each role.
create temp table people on commit drop as
select s.role::text as who, min(s.user_id::text)::uuid as user_id
from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id is not null group by s.role;
grant select on people to authenticated;

create function pg_temp.as_who(p_who text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', (select p.user_id from people p where p.who = p_who), 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true),
         set_config('role', 'authenticated', true);
$$;
create function pg_temp.give(p_chips integer, p_request uuid) returns uuid language sql as $$
  select public.give_bonus_chips('00000000-0000-4000-8000-000000000211', p_chips, 'For the night', p_request);
$$;
grant execute on function pg_temp.as_who(text), pg_temp.give(integer, uuid) to authenticated;
delete from public.setting where key in ('bonus.daily_staff_cap', 'bonus.by_hand_cap');
create function pg_temp.movements() returns integer language sql as $$ select count(*)::integer from public.ledger_transaction; $$;
create function pg_temp.alerts() returns integer language sql as $$
  select count(*)::integer from public.alert where kind = 'bonus.daily_cap' and created_at >= now();
$$;

-- None set: the most any addition may be.
select pg_temp.as_who('admin');
select isnt(pg_temp.give(20000, '42500000-0000-4000-8000-000000000001'), null, 'with no cap set, an admin adds 20,000 at once');

-- Only a super admin sets the cap.
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'bonus.by_hand_cap', '', '{"chips": 5000}', 'test 425') $$,
  '42501', null, 'an admin does not set the cap');
select pg_temp.as_who('super_admin');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, reason)
                   values ('00000000-0000-4000-8000-000000000001', 'bonus.by_hand_cap', '', '{"chips": 5000.0}', 'test 425') $$,
  'a super admin sets it at 5,000, written with a point as an API may write it');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'bonus.by_hand_cap', '', '{"chips": 100050}', now() + interval '1 day', 'test 425') $$,
  null, null, 'never above the most any addition may be');

-- At the cap and under it, added; above it, refused for an admin and a floor manager.
select pg_temp.as_who('admin');
select isnt(pg_temp.give(5000, gen_random_uuid()), null, 'an admin adds 5,000, the cap itself');
reset role;
create temp table before_refusal on commit drop as select pg_temp.movements() as count;
select pg_temp.as_who('admin');
select throws_ok($$ select pg_temp.give(5050, gen_random_uuid()) $$, 'RVCAP', null, 'and is refused 5,050');
select pg_temp.as_who('floor');
select throws_ok($$ select pg_temp.give(5050, gen_random_uuid()) $$, 'RVCAP', null, 'a floor manager is refused 5,050 too');
select isnt(pg_temp.give(50, gen_random_uuid()), null, 'and adds 50');
reset role;
select is(pg_temp.movements(), (select count + 1 from before_refusal), 'a refusal moves nothing in the ledger: only the 50 did');

-- A super admin is not held to it (the owner, 15 Nov).
select pg_temp.as_who('super_admin');
select isnt(pg_temp.give(5050, gen_random_uuid()), null, 'a super admin adds 5,050: the cap is not theirs');
select isnt(pg_temp.give(100000, gen_random_uuid()), null, 'and 1,00,000, the most any addition may be');
select throws_ok($$ select pg_temp.give(100050, gen_random_uuid()) $$, 'RVCHP', null, 'but never more than that');
reset role;

-- A retry of one that went through before the cap is answered with it.
select pg_temp.as_who('admin');
select is(pg_temp.give(20000, '42500000-0000-4000-8000-000000000001'),
  (select id from public.bonus_grant where idempotency_key = 'bonus.hand:42500000-0000-4000-8000-000000000001'),
  'the 20,000 added before the cap, asked again, is the same grant');
select throws_ok($$ select pg_temp.give(50, '42500000-0000-4000-8000-000000000001') $$, '22023', null, 'the same request for another amount is refused, under the cap or not');
reset role;
select is((select count(*)::integer from public.bonus_grant where idempotency_key = 'bonus.hand:42500000-0000-4000-8000-000000000001'), 1, 'and it was added once');

-- With a daily limit too, written with a point: the cap on one addition answers first, and alerts no one; under it, the
-- daily limit holds as before.
select pg_temp.as_who('super_admin');
insert into public.setting (venue_id, key, subject, value, reason)
values ('00000000-0000-4000-8000-000000000001', 'bonus.daily_staff_cap', '', '{"chips": 10000.0}', 'test 425');
select pg_temp.as_who('admin');
select throws_ok($$ select pg_temp.give(5050, gen_random_uuid()) $$, 'RVCAP', null, 'above the cap and past the daily limit: refused for the cap');
reset role;
select is(pg_temp.alerts(), 0, 'and the owner is not alerted for it');
select pg_temp.as_who('admin');
select is(pg_temp.give(50, gen_random_uuid()), null, 'under the cap and past the daily limit: nothing is added, as before');
reset role;
select is(pg_temp.alerts(), 1, 'and the owner hears of that');
select pg_temp.as_who('super_admin');
select isnt(pg_temp.give(50, gen_random_uuid()), null, 'a super admin, who has given 1,05,100 tonight, is held to neither');

select * from finish();
rollback;
