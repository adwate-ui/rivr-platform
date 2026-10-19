-- High hands (#47): on a tablet fixed to Table 3 during Pema's down, the dealer claims a high hand
-- for a hand of the down (flow 6: straight flush, seat 4); the floor approves it at the payout in
-- force when the hand was played, paid in chips at the club's cost; a decision is final; tonight's
-- best shows in public_high_hand. 103 Aditya is an admin (approves jackpots), 106 Pema a dealer,
-- 201 Arjun a member; the seed pays royal flush ₹25,000, straight flush ₹10,000, four of a kind ₹2,000.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.natural(p_code text) returns bigint language sql as $$
  select natural_balance from public.ledger_balance where venue_id = '00000000-0000-4000-8000-000000000001' and code = p_code;
$$;
grant execute on function pg_temp.as_person(text) to authenticated, anon;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select a.venue_id, a.table_id, s.id, a.device_id
from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id
where a.device_id = '00000000-0000-4000-8000-00000000d001';

-- Five hands of the down, as the tablet logs them.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table hands on commit drop as
select n, public.log_hand(1000000, 'holdem', now(), 'high-hand-test-' || n) as hand_id from generate_series(1, 5) as n;
reset role;
grant select on hands to authenticated;
create temporary table before_balances on commit drop as
select pg_temp.natural('venue.high_hand_expense') as expense, pg_temp.natural('venue.chips_outstanding') as chips;

-- Claiming, on the tablet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.claim_high_hand((select hand_id from hands where n = 1), 4, 'straight_flush', null) $$, '42501', null,
  'staff do not claim a high hand: the dealer does, on the tablet');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.claim_high_hand(gen_random_uuid(), 4, 'straight_flush', null) $$, '22023', null,
  'only for a hand of the down on this tablet');
select throws_ok($$ select public.claim_high_hand((select hand_id from hands where n = 1), 11, 'straight_flush', null) $$, '23514', null,
  'at a seat from 1 to 10');
create temporary table flow6 on commit drop as
select public.claim_high_hand((select hand_id from hands where n = 1), 4, 'straight_flush', null) as claim_id;
grant select on flow6 to authenticated;
select is((select public.claim_high_hand((select hand_id from hands where n = 1), 4, 'straight_flush', null)), (select claim_id from flow6),
  'flow 6: a straight flush at seat 4; claiming it again is the same claim');
select throws_ok($$ select public.claim_high_hand((select hand_id from hands where n = 1), 5, 'straight_flush', null) $$, '23505', null,
  'and a different claim for that hand is refused');
select results_eq($$ select status, seat, category from public.high_hand_claim $$,
  $$ values ('claimed'::public.high_hand_status, 4::smallint, 'straight_flush'::public.high_hand_category) $$, 'the tablet sees its claim');
reset role;
select results_eq($$ select c.table_id, s.user_id from public.high_hand_claim c join public.staff s on s.id = c.dealer_staff_id $$,
  $$ select t.id, '00000000-0000-4000-8000-000000000106'::uuid from public.game_table t
     where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 3' $$,
  'the claim is Table 3''s, by Pema, the dealer of the down');
select ok(exists (select 1 from public.outbox_event o where o.event_type = 'high_hand.claimed' and o.payload ->> 'claim_id' = (select claim_id::text from flow6)),
  'high_hand.claimed goes out');

-- Who sees claims.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.high_hand_claim $$, 'a member sees no claims');
select throws_ok($$ select * from public.high_hands('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor the console''s list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select status, category, table_name, payout_paise, dealer_name from public.high_hands('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('claimed'::public.high_hand_status, 'straight_flush'::public.high_hand_category, 'Table 3'::text, 1000000::bigint, 'Pema Lepcha'::text) $$,
  'the floor sees the claim with what it pays now: ₹10,000');
select throws_ok($$ update public.high_hand_claim set status = 'approved' $$, '42501', null, 'and changes it only through approval');

-- Approving.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.approve_high_hand((select claim_id from flow6), 1000000) $$, '42501', null, 'a dealer cannot approve it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.approve_high_hand((select claim_id from flow6), 200000) $$, 'RVSTL', null,
  'the floor pays only the amount it was shown, and that is the payout now');
select is(public.approve_high_hand((select claim_id from flow6), 1000000), 1000000::bigint, 'the floor approves: ₹10,000');
select is(public.approve_high_hand((select claim_id from flow6), 1000000), 1000000::bigint, 'approving again is the same approval');
select throws_ok($$ select public.reject_high_hand((select claim_id from flow6), 'Misread the board') $$, 'RVDUP', null,
  'an approved high hand is not rejected');
reset role;
select results_eq($$ select pg_temp.natural('venue.high_hand_expense') - expense, pg_temp.natural('venue.chips_outstanding') - chips from before_balances $$,
  $$ values (1000000::bigint, 1000000::bigint) $$, '₹10,000 of chips into play, at the club''s high-hand cost, posted once');
select is((select count(*)::int from public.ledger_transaction where idempotency_key = 'high_hand:' || (select claim_id from flow6)), 1,
  'in one transaction');
select results_eq($$ select s.user_id, c.decided_at is not null from public.high_hand_claim c join public.staff s on s.id = c.decided_by_staff_id
                     where c.id = (select claim_id from flow6) $$,
  $$ values ('00000000-0000-4000-8000-000000000103'::uuid, true) $$, 'recorded as approved by Aditya');
select ok(exists (select 1 from public.outbox_event o where o.event_type = 'high_hand.approved' and (o.payload ->> 'payout_paise')::bigint = 1000000),
  'high_hand.approved goes out');
select throws_ok($$ update public.high_hand_claim set seat = 5 where id = (select claim_id from flow6) $$, '22023', null,
  'a decided high hand is final, even for the database owner');

-- Tonight's best, for the TV.
set local role anon;
select results_eq($$ select venue_slug, category, table_name, payout_paise from public.public_high_hand $$,
  $$ values ('gurugram'::text, 'straight_flush'::public.high_hand_category, 'Table 3'::text, 1000000::bigint) $$,
  'flow 6: the TV''s high hand is a straight flush, Table 3, ₹10,000');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table quads on commit drop as
select public.claim_high_hand((select hand_id from hands where n = 2), 7, 'four_of_a_kind', ' Queens ') as claim_id;
create temporary table royal on commit drop as
select public.claim_high_hand((select hand_id from hands where n = 3), 2, 'royal_flush', null) as claim_id;
grant select on quads, royal to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.approve_high_hand((select claim_id from quads), 200000), 200000::bigint, 'four Queens pays ₹2,000');
select lives_ok($$ select public.reject_high_hand((select claim_id from royal), 'Not a royal: the board had no ten') $$, 'a claim is rejected with a reason');
select lives_ok($$ select public.reject_high_hand((select claim_id from royal), 'Not a royal: the board had no ten') $$, 'rejecting again is the same');
select throws_ok($$ select public.approve_high_hand((select claim_id from royal), 2500000) $$, 'RVDUP', null, 'and a rejected claim is not paid');
reset role;
select results_eq($$ select category, detail from public.public_high_hand $$,
  $$ values ('straight_flush'::public.high_hand_category, null::text) $$,
  'a later four of a kind does not beat the straight flush, and a rejected royal flush does not count');
select results_eq($$ select detail from public.high_hand_claim where id = (select claim_id from quads) $$, $$ values ('Queens'::text) $$,
  'the rank is kept trimmed');

-- Tonight begins at 06:00 IST.
select is(private.tonight_began('2026-10-19 05:59:00+05:30'), '2026-10-18 06:00:00+05:30'::timestamptz, 'before 06:00 IST it is still last night');
select is(private.tonight_began('2026-10-19 06:00:00+05:30'), '2026-10-19 06:00:00+05:30'::timestamptz, 'from 06:00 IST it is tonight');

-- A high hand that pays nothing is not claimed.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'high_hand.payouts', '',
        '{"royal_flush": 2500000, "straight_flush": 1000000, "four_of_a_kind": 0}', now() - interval '1 second', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.claim_high_hand((select hand_id from hands where n = 4), 3, 'four_of_a_kind', 'Aces') $$, '22023', null,
  'four of a kind pays nothing under that rule, so it is not claimed');

-- Promotions switched off, then the venue frozen.
create temporary table late on commit drop as
select public.claim_high_hand((select hand_id from hands where n = 4), 3, 'straight_flush', null) as claim_id;
grant select on late to authenticated;
reset role;
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.approve_high_hand((select claim_id from late), 1000000) $$, 'RVKIL', null, 'no high hand is paid while promotions are off');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.claim_high_hand((select hand_id from hands where n = 5), 3, 'straight_flush', null) $$, 'RVFRZ', null,
  'nor claimed while the venue is frozen');
reset role;

select * from finish();
rollback;
