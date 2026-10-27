-- Rewards redemptions follow the kill switch, and pot data is a super admin's alone (#462). Mihir (213) has points and
-- a cap waiting; with redemptions switched off he redeems nothing more and the host desk (108) hands nothing over.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 20000, 'Test', 'test:164:mihir');
insert into public.reward_item (venue_id, kind, name, detail, points)
values ('00000000-0000-4000-8000-000000000001', 'merchandise', 'Kill switch cap', 'At the desk', 1000);
insert into ids select 'item', id from public.reward_item where name = 'Kill switch cap';

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'waiting', public.redeem_reward((select id from ids where name = 'item'), 1000, 'kill-1');
select isnt((select id from ids where name = 'waiting'), null, 'Mihir redeems a cap while redemptions are on');
reset role;

insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'redemptions', 'Stock count', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.redeem_reward((select id from ids where name = 'item'), 1000, 'kill-2') $$, 'RVKIL', null,
  'switched off, he redeems no more');
select is(public.redeem_reward((select id from ids where name = 'item'), 1000, 'kill-1'), (select id from ids where name = 'waiting'),
  'though a retried tap still finds the redemption he made before');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.hand_over_redemption((select id from ids where name = 'waiting')) $$, 'RVKIL', null,
  'and the host desk hands nothing over');
reset role;

select throws_ok($$ insert into public.role_permission (role, permission) values ('admin', 'pot_data.read') $$, '23514', null,
  'pot data is never granted to an admin');
select is((select array_agg(role::text) from public.role_permission where permission = 'pot_data.read'), array['super_admin'],
  'a super admin alone holds it');

select * from finish();
rollback;
