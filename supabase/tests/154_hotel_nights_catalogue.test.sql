-- Hotel nights in the catalogue (#146; question #486; decision 0246). A hotel-night reward costs whole nights, taken
-- from the member's nights (thousandths) as other rewards take points. Marketing (107 Ishita) prices one at two
-- nights. Mihir (213) holds two and a half nights and 3,000 points: he redeems it, is left half a night, and cannot
-- redeem a second; a points reward still costs points. Erasure forfeits his nights to the venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.nights(p_member text) returns bigint language sql as $$
  select coalesce(-private.account_balance(a.id), 0) from public.ledger_account a
  where a.member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid and a.code = 'member.nights';
$$;
create temporary table item_ids (name text primary key, id uuid not null);
grant select on item_ids to authenticated;
create function pg_temp.item(p_name text) returns uuid language sql as $$ select id from item_ids where name = p_name; $$;
grant execute on function pg_temp.item(text) to authenticated;

select results_eq($$ select points, nights from public.reward_item where id = '00000000-0000-4000-8000-000000145004' $$,
  $$ values (null::bigint, 1) $$, 'the seeded hotel suite is priced in nights now: one');
select throws_ok($$ update public.reward_item set points = 45000 where id = '00000000-0000-4000-8000-000000145004' $$, '23514', null,
  'a hotel night is never priced in points');

select private.post_nights('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 2500, 'nights_earned', 'Test', 'test:154:mihir');
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 3000, 'Test', 'test:154:mihir:points');

-- Marketing prices a hotel night in nights, and nothing else in nights.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'hotel_night', 'Partner hotel, two nights',
                                                 'The host confirms by text', null, true, p_nights => 2) $$, 'marketing adds a two-night stay');
select throws_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'hotel_night', 'Hotel for points', 'Host', 45000, true) $$,
  '22023', null, 'but not a hotel night for points');
select throws_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'merchandise', 'Cap for nights', 'Host', null, true,
                                                  p_nights => 1) $$, '22023', null, 'nor anything else for nights');
reset role;
insert into item_ids select name, id from public.reward_item where venue_id = '00000000-0000-4000-8000-000000000001';

-- Mihir redeems the stay for the two nights shown.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.redeem_reward(pg_temp.item('Partner hotel, two nights'), null, 'mihir-stay', 1) $$, 'RVPRC', null,
  'not for a price he was not shown');
select throws_ok($$ select public.redeem_reward(pg_temp.item('Partner hotel, two nights'), 45000, 'mihir-stay') $$, 'RVPRC', null,
  'nor for points');
select lives_ok($$ select public.redeem_reward(pg_temp.item('Partner hotel, two nights'), null, 'mihir-stay', 2) $$, 'he redeems it for two nights');
select is(public.redeem_reward(pg_temp.item('Partner hotel, two nights'), null, 'mihir-stay', 2), (select id from public.redemption),
  'the same key again gives the same redemption');
select throws_ok($$ select public.redeem_reward(pg_temp.item('Partner hotel, two nights'), null, 'mihir-stay-2', 2) $$, 'RVNGT', null,
  'half a night left: not enough for a second');
select results_eq($$ select reward_name, points, nights from public.my_redemptions() $$,
  $$ values ('Partner hotel, two nights'::text, null::bigint, 2) $$, 'his redemptions show the two nights it took');
reset role;
select is(pg_temp.nights('213'), 500::bigint, 'it took 2,000 of his 2,500 thousandths, once');
select results_eq(
  $$ select t.kind, r.points, r.nights from public.redemption r join public.ledger_transaction t on t.id = r.ledger_transaction_id
     where r.member_id = '00000000-0000-4000-8000-000000000213' $$,
  $$ values ('nights_redeemed'::text, null::bigint, 2) $$, 'the nights left through a redemption on the ledger');
select is((select payload ->> 'nights' from public.outbox_event where event_type = 'reward.redeemed'), '2', 'reward.redeemed says two nights');

-- A points reward still costs points.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select lives_ok($$ select public.redeem_reward(pg_temp.item('Bar upgrade, one night'), 2500, 'mihir-bar') $$, 'he redeems the bar upgrade for points');
select throws_ok($$ select public.redeem_reward(pg_temp.item('Sunday Main Event seat'), 12000, 'mihir-seat') $$, 'RVPTS', null,
  'and a Sunday seat is more points than he has left');
reset role;
select is(pg_temp.nights('213'), 500::bigint, 'nights untouched by a points reward');

-- The cage sees what each redemption took.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select reward_name, points, nights from public.venue_redemptions('00000000-0000-4000-8000-000000000001')
                     where member_id = '00000000-0000-4000-8000-000000000213' order by reward_name $$,
  $$ values ('Bar upgrade, one night'::text, 2500::bigint, null::integer), ('Partner hotel, two nights', null, 2) $$,
  'the cage sees two nights for the stay and 2,500 points for the bar');
reset role;

-- Erasure forfeits nights to the venue, as it does points.
select is((private.forfeit_member_rewards(m) ->> 'nights_thousandths')::bigint, 500::bigint, 'erasure forfeits his half night')
from public.member m where m.id = '00000000-0000-4000-8000-000000000213';
select is(pg_temp.nights('213'), 0::bigint, 'and he holds none');

select * from finish();
rollback;
