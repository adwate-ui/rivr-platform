-- A daily cap on points given by hand (#798): past the club's points.daily_staff_cap a change gives nothing (no transaction)
-- and the owner hears of it once a staff member a night; super admins are not capped; none set is no cap; a retry of a
-- change that went through is answered with it; unlocking is not counted; last night's points and alert do not count
-- tonight; only a super admin changes the cap. 104 and 105 are cashiers (points.give), 103 an admin, 101 a super admin;
-- Ishaan (211) is the member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.alerts() returns integer language sql as $$
  select count(*)::integer from public.alert where kind = 'points.daily_cap' and venue_id = '00000000-0000-4000-8000-000000000001'
    and created_at >= private.tonight_began(now());
$$;
create function pg_temp.earned() returns bigint language sql as $$
  select coalesce(-private.account_balance(a.id), 0) from public.ledger_account a
  where a.member_id = '00000000-0000-4000-8000-000000000211' and a.code = 'member.points';
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
delete from public.setting where key = 'points.daily_staff_cap';

-- None set: no cap.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000211', 5000, false, 'Welcome back', gen_random_uuid()), null,
  'with no cap set, a cashier gives 5,000 points');
reset role;

-- The club sets 1,000 a staff member a club day.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'points.daily_staff_cap', '', '{"points": 1000}', '-infinity', 'test 280');

-- An admin, who gives points, cannot raise their own cap.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'points.daily_staff_cap', '', '{"points": 1000000}', now(), 'Busy night') $$,
  '42501', 'Only a super admin changes points.daily_staff_cap', 'an admin cannot raise the cap: only a super admin changes it');
reset role;

-- Last night the second cashier gave 900 and was past the cap once; neither counts tonight.
select pg_temp.as_person('00000000-0000-4000-8000-000000000105');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000211', 900, false, 'Last night', '280a0000-0000-4000-8000-000000000009'), null,
  'the second cashier gives 900');
reset role;
-- The ledger's balance checks run first (as in 007_ledger), so its append-only guard can be set aside to date the grant.
set constraints all immediate;
alter table public.ledger_transaction disable trigger ledger_transaction_append_only;
update public.ledger_transaction set occurred_at = private.tonight_began(now()) - interval '1 minute'
where idempotency_key = 'points.grant:280a0000-0000-4000-8000-000000000009';
alter table public.ledger_transaction enable trigger ledger_transaction_append_only;
set constraints all deferred;
insert into public.alert (venue_id, kind, detail, raised_at, created_at)
select s.venue_id, 'points.daily_cap', jsonb_build_object('staff_id', s.id, 'cap', 1000),
       private.tonight_began(now()) - interval '1 hour', private.tonight_began(now()) - interval '1 hour'
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000105' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select is(private.points_given_tonight('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000105'), 0::bigint,
  'a minute before the club day began counts as last night');

select pg_temp.as_person('00000000-0000-4000-8000-000000000105');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000211', 600, true, 'Locked for the league', '280a0000-0000-4000-8000-000000000001'), null,
  'another cashier gives 600 locked points');
reset role;
create temp table before_refusal on commit drop as select pg_temp.earned() as earned;
select pg_temp.as_person('00000000-0000-4000-8000-000000000105');
select is(public.grant_points('00000000-0000-4000-8000-000000000211', 500, false, 'Birthday', '280a0000-0000-4000-8000-000000000002'), null,
  '500 more would pass 1,000 tonight: nothing is given');
select is(public.grant_points('00000000-0000-4000-8000-000000000211', 500, false, 'Birthday', '280a0000-0000-4000-8000-000000000002'), null,
  'asked again, still nothing');
reset role;
select is(pg_temp.earned(), (select earned from before_refusal), 'the member''s points did not move');
select is(pg_temp.alerts(), 1, 'the owner hears of it once tonight, though told of that cashier last night');
select is((select (detail ->> 'cap')::integer from public.alert where kind = 'points.daily_cap' and created_at >= private.tonight_began(now())), 1000,
  'with the cap, and the staff member, no member');
select ok((select detail ? 'staff_id' and not detail ? 'member_id' from public.alert where kind = 'points.daily_cap'
           and created_at >= private.tonight_began(now())), 'by staff member only');

select pg_temp.as_person('00000000-0000-4000-8000-000000000105');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000211', 400, false, 'Birthday', '280a0000-0000-4000-8000-000000000003'), null,
  '400 brings the cashier to exactly 1,000: given');
select is(public.grant_points('00000000-0000-4000-8000-000000000211', 600, true, 'Locked for the league', '280a0000-0000-4000-8000-000000000001'),
  (select id from public.ledger_transaction where idempotency_key = 'points.lock:280a0000-0000-4000-8000-000000000001'),
  'a retry of the first change is answered with it, never refused by the cap');
select isnt(public.unlock_points('00000000-0000-4000-8000-000000000211', 100, 'Released', gen_random_uuid()), null,
  'unlocking gives no new points and is not capped');
select is(public.grant_points('00000000-0000-4000-8000-000000000211', 1, false, 'One more', gen_random_uuid()), null,
  'one point more is past the cap');
reset role;
select is(pg_temp.alerts(), 1, 'still one alert for that cashier tonight');

-- The cashier who gave 5,000 before the cap is past it too; that is another staff member, so another alert.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is(public.grant_points('00000000-0000-4000-8000-000000000211', 10, false, 'Tea', gen_random_uuid()), null, 'the first cashier is past it');
reset role;
select is(pg_temp.alerts(), 2, 'and the owner hears of that cashier too');

-- A super admin sets the cap and is not capped.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.grant_points('00000000-0000-4000-8000-000000000211', 5000, false, 'Owner''s gift', gen_random_uuid()), null,
  'a super admin gives 5,000');
reset role;

select * from finish();
rollback;
