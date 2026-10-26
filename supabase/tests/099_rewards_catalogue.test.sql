-- The rewards catalogue and redemption (#145; decision 0181). Marketing (107 Ishita) keeps the catalogue;
-- a member whose tier has rewards.catalogue redeems an item with points, once per key, never below
-- nothing; the cage (104 Sana), the host desk (108 Karan) or an admin hands it over. A dealer (106 Pema)
-- does neither. 213 Mihir and 214 Yash are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.points(p_member uuid) returns bigint language sql as $$
  select -private.account_balance(a.id) from public.ledger_account a where a.member_id = p_member and a.code = 'member.points';
$$;
-- Every reward's id by name, whoever is asking (taken once the catalogue is in).
create temporary table item_ids (name text primary key, id uuid not null);
grant select on item_ids to authenticated;
create function pg_temp.item(p_name text) returns uuid language sql as $$ select id from item_ids where name = p_name; $$;
grant execute on function pg_temp.item(text) to authenticated;

-- Mihir holds 20,000 points; Yash too, but his tier is denied the catalogue.
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 20000, 'Test', 'test:099:mihir');
select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 20000, 'Test', 'test:099:yash');
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'rewards.catalogue', false, 'Test');

-- Marketing keeps the catalogue: one of each kind.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'tournament_seat', 'RIVR Sunday seat',
                                                 'Registered at the cage', 12000, true, p_stock => 2) $$, 'marketing adds a Sunday seat, two of them');
select lives_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'fnb_upgrade', ' F&B upgrade ',
                                                 'At the Glaza bar', 2500, true) $$, 'an F&B upgrade, as many as members like');
select lives_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'merchandise', 'RIVR cap',
                                                 'At the host desk', 4000, true, p_stock => 1) $$, 'a cap, the last one');
select lives_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'hotel_night', 'Partner hotel, one night',
                                                 'The host confirms by SMS', 45000, true, p_stock => 6) $$, 'and a hotel night');
select throws_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'cash', '₹1,000 to cash',
                                                  'Credited to cash', 10000, true) $$, '22023', null, 'points never buy cash');
select throws_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'merchandise', 'Free cap',
                                                  'At the host desk', 0, true) $$, '22023', null, 'nothing is free');
select is((select count(*)::integer from public.reward_item where name = 'F&B upgrade'), 1, 'the name is trimmed');
reset role;
insert into public.reward_item (venue_id, kind, name, detail, points)
values ('00000000-0000-4000-8000-000000000002', 'merchandise', 'Practice cap', 'At the practice desk', 10);
insert into item_ids select name, id from public.reward_item
where name in ('RIVR Sunday seat', 'F&B upgrade', 'RIVR cap', 'Partner hotel, one night', 'Practice cap');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'merchandise', 'Mug',
                                                  'At the host desk', 1000, true) $$, '42501', null, 'a dealer keeps no catalogue');
select is_empty($$ select * from public.reward_item $$, 'and sees none of it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'merchandise', 'RIVR cap', 'At the host desk', 1, true,
                                                  pg_temp.item('RIVR cap'), 1) $$, '42501', null, 'nor does the cage reprice one');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'merchandise', 'Practice cap', 'At the practice desk',
                                                  1, true, pg_temp.item('Practice cap')) $$, '42501', null,
  'marketing changes only its own venue''s rewards');

-- Mihir sees the four, and redeems the cap.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.reward_item where id in (select id from item_ids)), 4,
  'Mihir sees the four rewards, and not the practice venue''s');
select lives_ok($$ select public.redeem_reward(pg_temp.item('RIVR cap'), 'mihir-cap-1') $$, 'he redeems the cap');
select is((select count(*)::integer from public.redemption), 1, 'and sees his redemption');
reset role;
select is(pg_temp.points('00000000-0000-4000-8000-000000000213'), 16000::bigint, 'it took 4,000 of his 20,000 points');
select is((select stock from public.reward_item where name = 'RIVR cap'), 0, 'and the last cap');
select is((select count(*)::integer from public.outbox_event where event_type = 'reward.redeemed'), 1, 'reward.redeemed is emitted');
select is((select t.kind from public.redemption r join public.ledger_transaction t on t.id = r.ledger_transaction_id), 'points_redeemed',
  'the points left through a redemption on the ledger');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is(public.redeem_reward(pg_temp.item('RIVR cap'), 'mihir-cap-1'), (select id from public.redemption),
  'the same key again gives the same redemption');
reset role;
select is(pg_temp.points('00000000-0000-4000-8000-000000000213'), 16000::bigint, 'and takes nothing more');
select is((select count(*)::integer from public.outbox_event where event_type = 'reward.redeemed'), 1, 'nor tells anyone again');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.redeem_reward(pg_temp.item('RIVR cap'), 'mihir-cap-2') $$, 'RVRWD', null, 'none are left for a second');
select throws_ok($$ select public.redeem_reward(pg_temp.item('F&B upgrade'), 'mihir-cap-1') $$, '22023', null,
  'a key that redeemed the cap redeems nothing else');
select throws_ok($$ select public.redeem_reward(pg_temp.item('Partner hotel, one night'), 'mihir-hotel') $$, 'RVPTS', null,
  'a hotel night is 45,000 points: more than he holds');
select throws_ok($$ select public.redeem_reward(pg_temp.item('F&B upgrade'), '') $$, '22023', null, 'a redemption carries a key');
select throws_ok($$ select public.redeem_reward(pg_temp.item('Practice cap'), 'mihir-practice') $$, 'RVRWD', null,
  'the practice venue''s rewards are not his to redeem');
select throws_ok($$ insert into public.redemption (venue_id, member_id, reward_item_id, points, idempotency_key, ledger_transaction_id)
                    select venue_id, member_id, reward_item_id, 1, 'direct', ledger_transaction_id from public.redemption $$,
  '42501', null, 'redemptions are written only through redeem_reward');

-- A retired reward is off the catalogue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.save_reward_item('00000000-0000-4000-8000-000000000001', 'tournament_seat', 'RIVR Sunday seat',
                                                 'Registered at the cage', 12000, false, pg_temp.item('RIVR Sunday seat'), 2) $$, 'marketing retires the seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.reward_item where id in (select id from item_ids)), 3, 'Mihir no longer sees the seat');
select throws_ok($$ select public.redeem_reward(pg_temp.item('RIVR Sunday seat'), 'mihir-seat') $$, 'RVRWD', null, 'nor redeems it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.redeem_reward(pg_temp.item('F&B upgrade'), 'staff') $$, '42501', null, 'nobody but a member redeems');

-- Yash's tier is denied the catalogue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select is_empty($$ select * from public.reward_item $$, 'Yash sees no catalogue');
select throws_ok($$ select public.redeem_reward(pg_temp.item('F&B upgrade'), 'yash-1') $$, '42501', null, 'and redeems nothing');
select is_empty($$ select * from public.redemption $$, 'nor sees Mihir''s redemption');

-- Handing it over.
reset role;
insert into item_ids select 'redemption', id from public.redemption;
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.venue_redemptions('00000000-0000-4000-8000-000000000001') $$, 'a dealer sees no redemptions');
select throws_ok($$ select public.hand_over_redemption(pg_temp.item('redemption')) $$, '42501', null, 'nor hands one over');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select full_name, reward_name, kind, points, handed_over_at is null from public.venue_redemptions('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Mihir Shah'::text, 'RIVR cap'::text, 'merchandise'::text, 4000::bigint, true) $$, 'the cage sees Mihir''s cap waiting');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select lives_ok($$ select public.hand_over_redemption(pg_temp.item('redemption')) $$, 'the host desk hands it over');
select throws_ok($$ select public.hand_over_redemption(pg_temp.item('redemption')) $$, '22023', null, 'once');
select results_eq($$ select handed_over_at is not null, handed_over_by from public.venue_redemptions('00000000-0000-4000-8000-000000000001') $$,
  $$ values (true, 'Karan Gill'::text) $$, 'and the list says who did');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select count(*)::integer from public.venue_redemptions('00000000-0000-4000-8000-000000000001')), 1, 'marketing sees it too');

select * from finish();
rollback;
