-- Hand entry (#42): on a tablet fixed to Table 3 during Pema's down, a hand logs its rake, drop and
-- cap from the rules in force, posts them to the ledger and emits hand.logged; a replay is the same
-- hand; pots are whole ₹50 chips; no dealer, no hand; refused while frozen. The seeded jackpot is
-- ₹3,42,600, so flow 4's ₹100 drop makes ₹3,42,700. 103 Aditya is staff; 201 Arjun a member.
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
grant execute on function pg_temp.as_person(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
-- Pema's down at Table 3, as dealer_sign_in starts it.
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select a.venue_id, a.table_id, s.id, a.device_id
from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id
where a.device_id = '00000000-0000-4000-8000-00000000d001';
create temporary table before_balances on commit drop as
select pg_temp.natural('venue.rake') as rake, pg_temp.natural('venue.jackpot.main') as jackpot, pg_temp.natural('venue.chips_outstanding') as chips;

-- The rules the tablet shows the take with.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select results_eq($$ select rate_basis_points, cap_paise, is_jackpot_live, drop_paise, drop_above_paise, has_variation from public.tablet_rake_rules() $$,
  $$ values (500, 600000::bigint, true, 10000::bigint, 500000::bigint, true) $$,
  'the tablet reads Table 3''s rules: 5% to a ₹6,000 cap, a live jackpot taking ₹100 above ₹5,000, variations allowed');

-- Flow 4: a ₹48,000 Hold'em pot.
create temporary table flow4 on commit drop as
select public.log_hand(4800000, 'holdem', now(), 'hand-flow-4-request') as hand_id;
grant select on flow4 to authenticated;
select results_eq($$ select h.pot_paise, h.rake_paise, h.drop_paise, h.is_cap_applied, h.variant from public.hand h join flow4 f on f.hand_id = h.id $$,
  $$ values (4800000::bigint, 240000::bigint, 10000::bigint, false, 'holdem'::public.hand_variant) $$,
  'flow 4: rake ₹2,400, drop ₹100, no cap');
select is((select public.log_hand(4800000, 'holdem', now(), 'hand-flow-4-request')), (select hand_id from flow4),
  'the same request again is the same hand');
select throws_ok($$ select public.log_hand(5000000, 'holdem', now(), 'hand-flow-4-request') $$, '22023', null,
  'and the same request with another pot is refused');
reset role;
select is(pg_temp.natural('venue.jackpot.main') - (select jackpot from before_balances), 10000::bigint, 'the jackpot rises by ₹100');
select is(pg_temp.natural('venue.jackpot.main'), 34270000::bigint, 'to ₹3,42,700, as flow 4 shows on the TV and Home');
select is(pg_temp.natural('venue.rake') - (select rake from before_balances), 240000::bigint, 'the house''s rake rises by ₹2,400');
select is((select chips from before_balances) - pg_temp.natural('venue.chips_outstanding'), 250000::bigint,
  'and ₹2,500 of chips leave play: the pull');
select is((select count(*)::integer from public.ledger_transaction where idempotency_key like 'hand:%'), 2,
  'two balanced postings, rake and drop, however often the hand is sent');
select ok(exists (select 1 from public.outbox_event e join flow4 f on e.payload ->> 'hand_id' = f.hand_id::text where e.event_type = 'hand.logged'),
  'hand.logged goes out');

-- Flow 5: a ₹1,40,000 pot at the cap, as PLO.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table flow5 on commit drop as
select public.log_hand(14000000, 'plo', now(), 'hand-flow-5-request') as hand_id;
select results_eq($$ select h.rake_paise, h.drop_paise, h.is_cap_applied from public.hand h join flow5 f on f.hand_id = h.id $$,
  $$ values (600000::bigint, 10000::bigint, true) $$, 'flow 5: rake ₹6,000, capped, and the ₹100 drop');
select throws_ok($$ select public.log_hand(4801000, 'holdem', now(), 'hand-odd-request') $$, '22023', null, 'a pot of ₹48,010 is not whole chips');
select throws_ok($$ select public.log_hand(0, 'holdem', now(), 'hand-zero-request') $$, '22023', null, 'nor is an empty pot a hand');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now() - interval '2 days', 'hand-old-request') $$, '22023', null,
  'a hand played two days ago is not logged now');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now() + interval '10 minutes', 'hand-future-request') $$, '22023', null,
  'nor one from the future');
select results_eq($$ select count(*)::integer, sum(rake_paise)::bigint from public.down_hands() $$, $$ values (2, 840000::bigint) $$,
  'the down''s hands: two, ₹8,400 of rake');
reset role;

-- Who sees hands.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.hand), 2, 'staff see the venue''s hands');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-staff-request') $$, '42501', null, 'but log none: only a tablet does');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.hand $$, 'a member sees no hands');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-member-request') $$, '42501', null, 'nor logs one');
reset role;

-- No dealer, no hand; a freeze, no hand.
update public.dealer_down set ended_at = now() where ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-no-dealer-request') $$, 'RVDWN', null,
  'between downs no hand is logged');
select is_empty($$ select * from public.down_hands() $$, 'and the next down starts with none');
reset role;
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select d.venue_id, d.table_id, d.staff_id, d.device_id from public.dealer_down d limit 1;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-frozen-request') $$, 'RVFRZ', null, 'and none while the venue is frozen');
reset role;
set local role anon;
select throws_ok($$ select * from public.tablet_rake_rules() $$, '42501', null, 'a visitor calls none of it');
reset role;

select * from finish();
rollback;
