-- Hand entry (#42): on a tablet fixed to Table 3 during Pema's down, a hand logs its rake, drop and
-- cap from the rules in force when it was played, posts them to the ledger and emits hand.logged; a
-- replay is the same hand; pots are whole ₹50 chips; a hand belongs to the down it was played in, on
-- the tablet the down began on, while its dealer may log hands; refused while frozen. The seeded
-- jackpot is ₹3,42,600, so flow 4's ₹100 drop makes ₹3,42,700. 103 Aditya is an admin (reads the
-- ledger), 106 Pema a dealer, 201 Arjun a member; all staff work at both venues.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The seed's floor (56_floor.sql) is set aside, so this test builds its own: the seeded tablets leave
-- their tables, which ends Pema's down at Table 3 (private.end_tablet_downs).
delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.natural(p_code text) returns bigint language sql as $$
  select natural_balance from public.ledger_balance where venue_id = '00000000-0000-4000-8000-000000000001' and code = p_code;
$$;
-- Pema's down on Tablet A, at whichever table it is fixed to, as dealer_sign_in starts it.
create function pg_temp.start_down() returns void language sql as $$
  insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
  select a.venue_id, a.table_id, s.id, a.device_id
  from public.tablet_assignment a
  join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = a.venue_id
  where a.device_id = '00000000-0000-4000-8000-00000000d001';
$$;
create function pg_temp.fix_tablet_to(p_table text) returns void language sql as $$
  update public.tablet_assignment set table_id = (select id from public.game_table
                                                  where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_table)
  where device_id = '00000000-0000-4000-8000-00000000d001';
$$;
create function pg_temp.open_downs() returns integer language sql as $$
  select count(*)::integer from public.dealer_down where ended_at is null;
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e001');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d001', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
select pg_temp.start_down();
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
select results_eq($$ select d.pot_paise, d.rake_paise, d.drop_paise, d.is_cap_applied, d.variant from public.down_hands() d join flow4 f using (hand_id) $$,
  $$ values (4800000::bigint, 240000::bigint, 10000::bigint, false, 'holdem'::public.hand_variant) $$,
  'flow 4: rake ₹2,400, drop ₹100, no cap');
select is((select public.log_hand(4800000, 'holdem', now(), 'hand-flow-4-request')), (select hand_id from flow4),
  'the same request again is the same hand');
select throws_ok($$ select public.log_hand(5000000, 'holdem', now(), 'hand-flow-4-request') $$, '22023', null,
  'and the same request with another pot is refused');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now() + interval '30 seconds', 'hand-flow-4-request') $$, '22023', null,
  'or played at another time');
reset role;
select is(pg_temp.natural('venue.jackpot.main') - (select jackpot from before_balances), 10000::bigint, 'the jackpot rises by ₹100');
select is(pg_temp.natural('venue.jackpot.main'), 34270000::bigint, 'to ₹3,42,700, as flow 4 shows on the TV and Home');
select is(pg_temp.natural('venue.rake') - (select rake from before_balances), 240000::bigint, 'the house''s rake rises by ₹2,400');
select is((select chips from before_balances) - pg_temp.natural('venue.chips_outstanding'), 250000::bigint,
  'and ₹2,500 of chips leave play: the pull');
select is((select count(*)::integer from public.ledger_transaction where idempotency_key like 'hand:%'
           and split_part(idempotency_key, ':', 2)::uuid in (select h.id from public.hand h where h.device_id = '00000000-0000-4000-8000-00000000d001')), 2,
  'two balanced postings, rake and drop, however often the hand is sent');
select ok(exists (select 1 from public.outbox_event e join flow4 f on e.payload ->> 'hand_id' = f.hand_id::text where e.event_type = 'hand.logged'),
  'hand.logged goes out');
select throws_ok($$ update public.hand set pot_paise = 5000000 $$, '42501', null, 'a hand is never changed');

-- Flow 5: a ₹1,40,000 pot at the cap, as PLO.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table flow5 on commit drop as
select public.log_hand(14000000, 'plo', now(), 'hand-flow-5-request') as hand_id;
select results_eq($$ select d.rake_paise, d.drop_paise, d.is_cap_applied from public.down_hands() d join flow5 f using (hand_id) $$,
  $$ values (600000::bigint, 10000::bigint, true) $$, 'flow 5: rake ₹6,000, capped, and the ₹100 drop');
select throws_ok($$ select public.log_hand(4801000, 'holdem', now(), 'hand-odd-request') $$, '22023', null, 'a pot of ₹48,010 is not whole chips');
select throws_ok($$ select public.log_hand(0, 'holdem', now(), 'hand-zero-request') $$, '22023', null, 'nor is an empty pot a hand');
select throws_ok($$ select public.log_hand(1000005000, 'holdem', now(), 'hand-huge-request') $$, '22023', null, 'nor a pot above ₹1 crore');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now() - interval '2 minutes', 'hand-early-request') $$, '22023', null,
  'a hand played before the down began is not logged in it');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now() + interval '10 minutes', 'hand-future-request') $$, '22023', null,
  'nor one from the future');
select results_eq($$ select count(*)::integer, sum(rake_paise)::bigint from public.down_hands() $$, $$ values (2, 840000::bigint) $$,
  'the down''s hands: two, ₹8,400 of rake');
select is_empty($$ select * from public.hand $$, 'the tablet reads its down''s hands through down_hands only');
select throws_ok($$ insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise,
                                             is_cap_applied, played_at, idempotency_key)
                    select venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, 0, 0, false, played_at, 'hand-forged'
                    from public.hand limit 1 $$, '42501', null, 'and writes no hand itself');
reset role;

-- Who sees hands: staff who read the ledger, at their own venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.hand where device_id = '00000000-0000-4000-8000-00000000d001'), 2,
  'an admin, who reads the ledger, sees the venue''s hands');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-staff-request') $$, '42501', null, 'but logs none: only a tablet does');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.hand $$, 'a dealer, who does not read the ledger, sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is_empty($$ select * from public.hand $$, 'nor does a member');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-member-request') $$, '42501', null, 'nor log one');
reset role;
update public.staff set is_active = false
where user_id = '00000000-0000-4000-8000-000000000103' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.hand where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'staff at the practice venue only see none of the club''s hands');
reset role;

-- A hand takes the rules in force when it was played: the cap falls to ₹3,000 from half an hour ago.
update public.dealer_down set started_at = now() - interval '2 hours' where ended_at is null;
-- As a migration would, with nobody signed in: only then may a rule take effect in the past.
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'rake.config', 'nlh_100_200', '{"rate_basis_points": 500, "cap_paise": 300000}',
        now() - interval '30 minutes', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
create temporary table dated on commit drop as
select public.log_hand(14000000, 'holdem', now() - interval '1 hour', 'hand-before-change') as hand_id, 'before' as played
union all select public.log_hand(14000000, 'holdem', now(), 'hand-after-change'), 'after';
reset role;
select results_eq($$ select d.played, h.rake_paise from public.hand h join dated d on d.hand_id = h.id order by d.played $$,
  $$ values ('after', 300000::bigint), ('before', 600000::bigint) $$,
  'a ₹1,40,000 pot played an hour ago is raked ₹6,000; played now, ₹3,000');

-- A down ends when its tablet leaves the table; Table 1 plays Hold'em only.
select pg_temp.fix_tablet_to('Table 1');
select is(pg_temp.open_downs(), 0, 'moving the tablet to Table 1 ends Pema''s down at Table 3');
select pg_temp.start_down();
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.log_hand(4800000, 'plo', now(), 'hand-plo-request') $$, '22023', null, 'Table 1 takes no PLO');
reset role;

-- A dealer who may no longer log hands logs none, though her down is still open.
update public.staff set is_active = false
where user_id = '00000000-0000-4000-8000-000000000106' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-inactive-request') $$, 'RVDWN', null,
  'an inactive dealer logs no hand');
reset role;
update public.staff set is_active = true
where user_id = '00000000-0000-4000-8000-000000000106' and venue_id = '00000000-0000-4000-8000-000000000001';
insert into public.control_state (venue_id, level, staff_id, reason)
select venue_id, 'access_revoke'::public.control_level, staff_id, 'Test' from public.dealer_down where ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-revoked-request') $$, 'RVDWN', null,
  'nor one whose access is revoked');
reset role;

-- A hand lands only on a down begun on the tablet that logs it; revoking a tablet ends its down.
update public.dealer_down set ended_at = now() where ended_at is null;
insert into public.device (id, venue_id, kind, name) values
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet B');
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select a.venue_id, a.table_id, s.id, '00000000-0000-4000-8000-00000000d002'
from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = a.venue_id
where a.device_id = '00000000-0000-4000-8000-00000000d001';
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-other-tablet-request') $$, 'RVDWN', null,
  'a down at this table begun on another tablet takes no hand from this one');
reset role;
update public.dealer_down set ended_at = now() where ended_at is null;
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d002', venue_id, id from public.game_table
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5';
insert into public.dealer_down (venue_id, table_id, staff_id, device_id)
select a.venue_id, a.table_id, s.id, a.device_id
from public.tablet_assignment a
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = a.venue_id
where a.device_id = '00000000-0000-4000-8000-00000000d002';
update public.device set revoked_at = now(), revoked_reason = 'Test' where id = '00000000-0000-4000-8000-00000000d002';
select is(pg_temp.open_downs(), 0, 'revoking Tablet B ends the down begun on it');

-- Between downs, no hand; a freeze, no hand, but a replay is still the hand logged.
select pg_temp.fix_tablet_to('Table 3');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-no-dealer-request') $$, 'RVDWN', null,
  'between downs no hand is logged');
select is_empty($$ select * from public.down_hands() $$, 'and the next down starts with none');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-frozen-request') $$, 'RVFRZ', null, 'none while the venue is frozen');
select is((select public.log_hand(4800000, 'holdem', now(), 'hand-flow-4-request')), (select hand_id from flow4),
  'but a replay is the hand already logged');
reset role;
set local role anon;
select throws_ok($$ select * from public.tablet_rake_rules() $$, '42501', null, 'a visitor reads no rules');
select throws_ok($$ select public.log_hand(4800000, 'holdem', now(), 'hand-anon-request') $$, '42501', null, 'logs no hand');
select throws_ok($$ select * from public.down_hands() $$, '42501', null, 'and reads no down');
reset role;

select * from finish();
rollback;
