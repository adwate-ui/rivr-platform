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
  $$ values ('bonus.give'::text), ('call_time.override'), ('floor.manage'), ('fnb.serve'), ('kyc.in_person'), ('members.phone'), ('members.read'),
            ('tvs.manage'), ('waitlist.manage') $$,
  'the floor runs tonight, the waitlist, call time, today''s players, orders and bonus chips by hand, checks members in person (decision 0301), sees members'' phones on the Door (decision 0690) and manages TVs');
select ok(not exists (select 1 from public.role_permission where role = 'floor'
                      and permission in ('tables.manage', 'members.manage', 'tournaments.manage', 'promotions.manage', 'devices.manage')),
  'but not tables setup, the member list, games history, tournaments, promotions or the cage''s computers');
select results_eq($$ select permission from public.role_permission where role = 'cashier'
                    and permission in ('waitlist.manage', 'floor.manage', 'call_time.override', 'devices.manage', 'fnb.serve') order by 1 $$,
  $$ values ('call_time.override'::text), ('floor.manage'), ('waitlist.manage') $$,
  'the cashier sees the same, less the food and drink orders');

-- Who asked about a tournament (the seed's next one) is for tournaments.manage: the cashier, who has the waitlist, reads none of it.
insert into public.tournament_interest (venue_id, tournament_id, member_id)
select '00000000-0000-4000-8000-000000000001', t.id, '00000000-0000-4000-8000-000000000213'
from public.tournament t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.starts_at > now() order by t.starts_at limit 1;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.venue_tournaments('00000000-0000-4000-8000-000000000001')), 0, 'the cashier reads no tournaments list');
select is((select count(*)::integer from public.tournament_interest), 0, 'nor who asked');
select throws_ok($$ select public.notify_tournament((select t.id from public.tournament t where t.venue_id = '00000000-0000-4000-8000-000000000001'
                                                     and t.starts_at > now() order by t.starts_at limit 1)) $$, '42501', null,
  'and notifies nobody');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select count(*)::integer from public.tournament_interested((select i.tournament_id from public.tournament_interest i
                                                                        where i.member_id = '00000000-0000-4000-8000-000000000213' limit 1))) >= 1,
  'an admin reads who asked');
reset role;

select * from finish();
rollback;
