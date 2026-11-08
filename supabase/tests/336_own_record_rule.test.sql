-- One own-record rule for staff-on-member actions (audit F-115, F-128). A host (108) whose number is on Mihir's record
-- (213) cannot hand over Mihir's redemption; another host (111) can. An admin (103) whose number is on Yash's record (214),
-- not yet linked to their login, cannot give Yash points by hand; Ayaan (215) they can.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Mihir redeems the cheapest reward with stock; the first host carries Mihir's number, the admin Yash's.
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 1000000, 'Test', 'test:336:mihir');
create temporary table cheapest as
select i.id, i.points from public.reward_item i
where i.venue_id = '00000000-0000-4000-8000-000000000001' and i.points > 0 and coalesce(i.stock, 1) > 0
order by i.points limit 1;
grant select on cheapest to authenticated;
update public.staff set phone = (select phone from public.member where id = '00000000-0000-4000-8000-000000000213')
where venue_id = '00000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000108';
update public.staff set phone = (select phone from public.member where id = '00000000-0000-4000-8000-000000000214')
where venue_id = '00000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000103';

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
create temporary table redeemed as select public.redeem_reward((select id from cheapest), (select points from cheapest), 'test-336') as id;
reset role;
grant select on redeemed to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.hand_over_redemption((select id from redeemed)) $$, 'RVOWN', 'Staff never hand over their own redemption',
                 'a host does not hand over their own redemption');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000111');
select lives_ok($$ select public.hand_over_redemption((select id from redeemed)) $$, 'another host does');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000214', 100, false, 'For the test', gen_random_uuid()) $$,
                 '42501', 'Nobody gives themselves points', 'an admin does not give points to the record with their own number');
select lives_ok($$ select public.grant_points('00000000-0000-4000-8000-000000000215', 100, false, 'For the test', gen_random_uuid()) $$,
                'but gives them to another member');
reset role;

select * from finish();
rollback;
