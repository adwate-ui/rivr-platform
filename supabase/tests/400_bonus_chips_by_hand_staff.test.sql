-- Bonus chips by hand past super admins (the owner, 9 Nov): admins and floor managers add them, cashiers and hosts do not. Below
-- a super admin each person adds at most the club's bonus.daily_staff_cap in a club day: past it nothing is added and the owner
-- hears of it once a person a night. None set is no cap; a retry of one that went through is answered with it; last night's do
-- not count tonight; only a super admin changes the limit. 211 is the member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed has no one on the Floor role, so two hosts take it here.
update public.staff s set role = 'floor'
where s.id in (select h.id from public.staff h where h.venue_id = '00000000-0000-4000-8000-000000000001' and h.role = 'host' and h.user_id is not null order by h.user_id limit 2);

-- The first staff member of each role, as `floor`, and the next as `floor2`.
create temp table people on commit drop as
select s.role::text || case when n = 1 then '' else n::text end as who, s.user_id
from (select st.*, row_number() over (partition by st.role order by st.user_id) as n
      from public.staff st where st.venue_id = '00000000-0000-4000-8000-000000000001' and st.user_id is not null) s;
grant select on people to authenticated;

create function pg_temp.as_who(p_who text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', (select p.user_id from people p where p.who = p_who), 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true),
         set_config('role', 'authenticated', true);
$$;
create function pg_temp.give(p_chips integer, p_request uuid) returns uuid language sql as $$
  select public.give_bonus_chips('00000000-0000-4000-8000-000000000211', p_chips, 'For the night', p_request);
$$;
create function pg_temp.alerts() returns integer language sql as $$
  select count(*)::integer from public.alert where kind = 'bonus.daily_cap' and venue_id = '00000000-0000-4000-8000-000000000001'
    and created_at >= private.tonight_began(now());
$$;
grant execute on function pg_temp.as_who(text), pg_temp.give(integer, uuid) to authenticated;
delete from public.setting where key = 'bonus.daily_staff_cap';

-- Who may, with none set.
select pg_temp.as_who('admin');
select isnt(pg_temp.give(20000, gen_random_uuid()), null, 'with no limit set, an admin adds 20,000 bonus chips');
select pg_temp.as_who('floor');
select isnt(pg_temp.give(500, gen_random_uuid()), null, 'a floor manager adds some too');
select pg_temp.as_who('cashier');
select throws_ok($$ select pg_temp.give(500, gen_random_uuid()) $$, '42501', null, 'a cashier, who gives points, adds no bonus chips');
select pg_temp.as_who('host');
select throws_ok($$ select pg_temp.give(500, gen_random_uuid()) $$, '42501', null, 'nor does a host');
reset role;

-- The club sets 1,000 a person a club day.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'bonus.daily_staff_cap', '', '{"chips": 1000}', '-infinity', 'test 400');

select pg_temp.as_who('admin');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'bonus.daily_staff_cap', '', '{"chips": 1000000}', now(), 'Busy night') $$,
  '42501', 'Only a super admin changes bonus.daily_staff_cap', 'an admin cannot raise the limit');

select pg_temp.as_who('floor');
select isnt(pg_temp.give(500, '40000000-0000-4000-8000-000000000001'), null, 'the floor manager adds up to the limit, 500 on top of the 500 given');
select isnt(pg_temp.give(500, '40000000-0000-4000-8000-000000000001'), null, 'a retry of one that went through is answered with it');
select is(pg_temp.give(50, '40000000-0000-4000-8000-000000000002'), null, 'past the limit nothing is added');
select is(pg_temp.give(50, '40000000-0000-4000-8000-000000000002'), null, 'asked again, still nothing');
reset role;
select is(pg_temp.alerts(), 1, 'the owner hears of it once tonight');
select is((select count(*)::integer from public.bonus_grant where idempotency_key = 'bonus.hand:40000000-0000-4000-8000-000000000002'), 0, 'and no grant was made');
select ok((select detail ? 'staff_id' and not detail ? 'member_id' from public.alert where kind = 'bonus.daily_cap' order by created_at desc limit 1),
  'the alert names the staff member, never the member');

select pg_temp.as_who('floor2');
select isnt(pg_temp.give(1000, gen_random_uuid()), null, 'each person has their own count: another floor manager adds 1,000');
select pg_temp.as_who('super_admin');
select isnt(pg_temp.give(5000, gen_random_uuid()), null, 'a super admin has no limit');
reset role;

-- Last night's do not count tonight.
set constraints all immediate;
alter table public.ledger_transaction disable trigger ledger_transaction_append_only;
update public.ledger_transaction t set occurred_at = private.tonight_began(now()) - interval '1 minute'
from public.bonus_grant g where g.ledger_transaction_id = t.id and g.idempotency_key like 'bonus.hand:%';
alter table public.ledger_transaction enable trigger ledger_transaction_append_only;
set constraints all deferred;
select is(private.bonus_given_tonight('00000000-0000-4000-8000-000000000001', (select user_id from people where who = 'floor')), 0::bigint,
  'a minute before the club day began counts as last night');

select * from finish();
rollback;
