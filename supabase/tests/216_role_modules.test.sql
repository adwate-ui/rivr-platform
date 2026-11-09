-- Each role sees the owner's modules (#644): the Floor role's permissions, what the cashier gained, and tournaments
-- for those who manage them, not the floor's waitlist. 104 Sana is a cashier; 103 Aditya an admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select results_eq($$ select permission from public.role_permission where role = 'floor' order by 1 $$,
  $$ values ('bonus.give'::text), ('call_time.override'), ('floor.manage'), ('fnb.serve'), ('incidents.log'), ('kyc.in_person'), ('members.read'),
            ('points.give'), ('rewards.hand_over'), ('rewards.manage'), ('sops.acknowledge'), ('tvs.manage'), ('waitlist.manage') $$,
  'the floor runs tonight, the waitlist, call time, today''s players, orders, rewards, points and bonus chips by hand, checks members in person (decision 0301) and manages TVs');
select ok(not exists (select 1 from public.role_permission where role = 'floor'
                      and permission in ('tables.manage', 'members.manage', 'tournaments.manage', 'promotions.manage', 'devices.manage')),
  'but not tables setup, the member list, games history, tournaments, promotions or the cage''s computers');
select results_eq($$ select permission from public.role_permission where role = 'cashier'
                    and permission in ('waitlist.manage', 'floor.manage', 'call_time.override', 'devices.manage', 'rewards.manage', 'points.give', 'fnb.serve') order by 1 $$,
  $$ values ('call_time.override'::text), ('floor.manage'), ('points.give'), ('rewards.manage'), ('waitlist.manage') $$,
  'the cashier sees the same, less the food and drink orders');

-- Interest in a tournament (the seed's next one), which the cashier now sees the waitlist beside, is for tournaments.manage.
insert into public.tournament_interest (venue_id, tournament_id, member_id)
select '00000000-0000-4000-8000-000000000001', t.id, '00000000-0000-4000-8000-000000000213'
from public.tournament t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.starts_at > now() order by t.starts_at limit 1;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.tournament_interest_list('00000000-0000-4000-8000-000000000001')), 0, 'the cashier reads no interest list');
select is((select count(*)::integer from public.tournament_interest), 0, 'nor the rows');
select throws_ok($$ select public.mark_tournament_registered((select i.id from public.tournament_interest i limit 1)) $$, '42501', null,
  'and marks nobody registered');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select count(*)::integer from public.tournament_interest_list('00000000-0000-4000-8000-000000000001')) >= 1, 'an admin reads it');
reset role;

select * from finish();
rollback;
