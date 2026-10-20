-- High-hand corrections and reversals (#324, decision 0112): before deciding, the floor corrects a
-- waiting claim's hand, rank or seat, and the dealer's claim stays beside it and in the audit log; a
-- decided claim is reversed with a reason, an approved payout posted back once, and the hand may be
-- claimed again. As in 043: Tablet A at Table 3 during Pema's down; 103 Aditya an admin (approves
-- jackpots), 106 Pema the dealer, 107 marketing; the seed pays straight flush ₹10,000, four of a kind
-- ₹2,000.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.tablet_assignment;

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
select '00000000-0000-4000-8000-00000000d001', t.venue_id, t.id from public.game_table t
where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = 'Table 3';
insert into public.dealer_down (venue_id, table_id, staff_id, device_id, started_at)
select a.venue_id, a.table_id, s.id, a.device_id, now() - interval '1 hour'
from public.tablet_assignment a join public.staff s on s.venue_id = a.venue_id and s.user_id = '00000000-0000-4000-8000-000000000106';

select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table hands on commit drop as
select n, public.log_hand(1000000, 'holdem', now(), 'correction-test-' || n) as hand_id from generate_series(1, 2) as n;
-- The dealer taps four of a kind, Queens, for what was a straight flush.
create temporary table claims on commit drop as
select 'first'::text as name, public.claim_high_hand((select hand_id from hands where n = 1), 4, 'four_of_a_kind', 'Q') as claim_id;
reset role;
grant select on hands, claims to authenticated;
create temporary table before_balances on commit drop as
select pg_temp.natural('venue.high_hand_expense') as expense, pg_temp.natural('venue.chips_outstanding') as chips;

-- Correcting a waiting claim.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.correct_high_hand((select claim_id from claims), 4, 'straight_flush', null) $$, '42501', null,
  'the dealer does not correct a claim');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.correct_high_hand((select claim_id from claims), 11, 'straight_flush', null) $$, 'RVSEA', null,
  'only to a seat the table has');
select throws_ok($$ select public.correct_high_hand((select claim_id from claims), 4, 'four_of_a_kind', null) $$, '23514', null,
  'a four of a kind still names its rank');
select lives_ok($$ select public.correct_high_hand((select claim_id from claims), 4, 'straight_flush', null) $$,
  'the floor corrects it to a straight flush before deciding');
select results_eq($$ select category, rank, seat, original_category, original_rank, original_seat, corrected_by_name
                     from public.high_hands('00000000-0000-4000-8000-000000000001') where claim_id = (select claim_id from claims) $$,
  $$ values ('straight_flush'::public.high_hand_category, null::text, 4::smallint, 'four_of_a_kind'::public.high_hand_category, 'Q'::text,
             4::smallint, (select full_name from public.staff where user_id = '00000000-0000-4000-8000-000000000103'
                                                               and venue_id = '00000000-0000-4000-8000-000000000001')) $$,
  'the console shows the claim as corrected, with what the dealer claimed');
reset role;
select ok(exists (select 1 from public.audit_log a where a.entity = 'high_hand_claim' and a.entity_id = (select claim_id from claims)::text
                  and a.action = 'update' and a.before ->> 'category' = 'four_of_a_kind' and a.after ->> 'category' = 'straight_flush'),
  'and the audit log keeps the dealer''s claim');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select is(public.claim_high_hand((select hand_id from hands where n = 1), 4, 'four_of_a_kind', 'Q'), (select claim_id from claims),
  'the tablet sending the dealer''s claim again, its answer lost, gets the same claim');
reset role;

-- Paid as corrected, then reversed.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.approve_high_hand((select claim_id from claims), 1000000), 1000000::bigint, 'the corrected claim is paid ₹10,000');
select throws_ok($$ select public.correct_high_hand((select claim_id from claims), 5, 'straight_flush', null) $$, 'RVDUP', null,
  'a decided claim is not corrected');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.reverse_high_hand((select claim_id from claims), 'Wrong hand') $$, '42501', null,
  'staff who do not approve jackpots reverse nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.reverse_high_hand((select claim_id from claims), 'The board was misread') $$, 'the floor reverses the approved claim');
select lives_ok($$ select public.reverse_high_hand((select claim_id from claims), 'The board was misread') $$, 'and reversing it again changes nothing');
reset role;
select results_eq($$ select status, payout_paise, reversed_reason from public.high_hand_claim where id = (select claim_id from claims) $$,
  $$ values ('reversed'::public.high_hand_status, 1000000::bigint, 'The board was misread'::text) $$, 'it shows as reversed, with what was paid');
select is((select count(*)::integer from public.ledger_transaction where idempotency_key = 'high_hand_reversal:' || (select claim_id from claims)), 1,
  'its payout is posted back once');
select ok((select expense from before_balances) = pg_temp.natural('venue.high_hand_expense')
          and (select chips from before_balances) = pg_temp.natural('venue.chips_outstanding'),
  'and the high-hand cost and the chips in play are as before it was paid');
select is((select count(*)::integer from public.outbox_event where event_type = 'high_hand.reversed'
           and payload ->> 'claim_id' = (select claim_id from claims)::text), 1, 'high_hand.reversed goes out once');
select is_empty($$ select * from public.public_high_hand where table_name = 'Table 3' $$, 'and the TVs no longer show it');

-- The hand may be claimed again; a rejected claim is reversed with no posting; a waiting one is not reversed.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
insert into claims select 'again', public.claim_high_hand((select hand_id from hands where n = 1), 4, 'straight_flush', null);
insert into claims select 'second', public.claim_high_hand((select hand_id from hands where n = 2), 2, 'four_of_a_kind', 'K');
reset role;
select ok((select claim_id from claims where name = 'again') <> (select claim_id from claims where name = 'first'),
  'the reversed hand is claimed again, as a new claim');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.correct_high_hand((select claim_id from claims where name = 'again'), 4, 'straight_flush', null);
select is((select corrected_at from public.high_hand_claim where id = (select claim_id from claims where name = 'again')), null,
  'saving a claim as it stands corrects nothing');
select throws_ok($$ select public.reverse_high_hand((select claim_id from claims where name = 'again'), 'Not yet decided') $$, '22023', null,
  'a claim still waiting is rejected, not reversed');
select public.reject_high_hand((select claim_id from claims where name = 'second'), 'Not a four of a kind');
select lives_ok($$ select public.reverse_high_hand((select claim_id from claims where name = 'second'), 'It was Kings after all') $$,
  'a rejected claim is reversed too');
reset role;
select is((select count(*)::integer from public.ledger_transaction where idempotency_key = 'high_hand_reversal:' || (select claim_id from claims where name = 'second')), 0,
  'with nothing to post back');
select throws_ok($$ update public.high_hand_claim set status = 'approved' where id = (select claim_id from claims where name = 'second') $$, '22023', null,
  'and a reversed claim is final');

select * from finish();
rollback;
