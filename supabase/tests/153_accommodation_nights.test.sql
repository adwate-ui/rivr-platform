-- Accommodation nights (#146; question #486; decision 0246). At 100/200 (Tables 2 and 3) twenty hours earn a hotel
-- night; at 50/100 (Table 1), forty. Mihir (213) sits at Table 2 for two hours, moves to Table 1 and stays three
-- more: 7,200 s at 20 hours a night is 100 thousandths, and 10,800 s at 40 is 75, so 175. Yash (214) plays five hours
-- at Table 2: 250, a quarter of a night. Kunal (216) plays ten hours at Table 1, but his tier has no
-- rewards.accommodation by then: nothing. Nights are a ledger balance of their own, in thousandths.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
-- Sunday 4 January 2026, 20:00 IST, long before anything seeded.
create function pg_temp.at(p_minutes integer) returns timestamptz language sql as $$
  select '2026-01-04T20:00:00+05:30'::timestamptz + make_interval(mins => p_minutes);
$$;
create function pg_temp.nights(p_member text) returns bigint language sql as $$
  select -private.account_balance(a.id) from public.ledger_account a
  where a.member_id = ('00000000-0000-4000-8000-000000000' || p_member)::uuid and a.code = 'member.nights';
$$;

insert into public.setting (venue_id, key, subject, value, effective_from) values
  ('00000000-0000-4000-8000-000000000001', 'accommodation.hours_per_night', 'nlh_100_200', '{"hours": 20}', '2026-01-01T06:00:00+05:30'),
  ('00000000-0000-4000-8000-000000000001', 'accommodation.hours_per_night', 'nlh_50_100', '{"hours": 40}', '2026-01-01T06:00:00+05:30');

insert into public.visit (id, venue_id, member_id, opened_at)
select ('00000000-0000-4000-8000-0000000a1' || m)::uuid, '00000000-0000-4000-8000-000000000001', ('00000000-0000-4000-8000-000000000' || m)::uuid, pg_temp.at(0)
from unnest(array['213', '214', '216']) m;
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds) values
  ('00000000-0000-4000-8000-0000000b1213', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
   '00000000-0000-4000-8000-0000000a1213', pg_temp.table_id('Table 1'), 1, pg_temp.at(0), pg_temp.at(120), pg_temp.at(300), 'left', 0),
  ('00000000-0000-4000-8000-0000000b1214', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214',
   '00000000-0000-4000-8000-0000000a1214', pg_temp.table_id('Table 2'), 2, pg_temp.at(0), pg_temp.at(0), pg_temp.at(300), 'left', 0),
  ('00000000-0000-4000-8000-0000000b1216', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
   '00000000-0000-4000-8000-0000000a1216', pg_temp.table_id('Table 1'), 2, pg_temp.at(0), pg_temp.at(0), pg_temp.at(600), 'left', 0);
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, created_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b1213', pg_temp.table_id('Table 2'), 1,
        pg_temp.table_id('Table 1'), 1, pg_temp.at(120));

select ok(not exists (select 1 from public.ledger_account where member_id = '00000000-0000-4000-8000-000000000214' and code = 'member.nights'),
  'a member has no nights account until they first earn a night');

-- The visits close: each table's time at its stake's hours a night, rounded down per table, credited once.
select isnt(private.close_visit('00000000-0000-4000-8000-000000000213', pg_temp.at(300), 'door'), null, 'Mihir''s visit closes');
select is(pg_temp.nights('213'), 175::bigint, 'two hours at 100/200 (100) and three at 50/100 (75): 175 thousandths of a night');
select isnt(private.close_visit('00000000-0000-4000-8000-000000000214', pg_temp.at(300), 'cash_out'), null, 'Yash''s visit closes');
select is(pg_temp.nights('214'), 250::bigint, 'five hours at 100/200: a quarter of a night');
select is(private.close_visit('00000000-0000-4000-8000-000000000214', pg_temp.at(400), 'door'), null, 'closing it again does nothing');
select lives_ok($$ select private.earn_visit_nights('00000000-0000-4000-8000-0000000a1214') $$, 'earning the visit again is harmless');
select is(pg_temp.nights('214'), 250::bigint, 'nothing is earned twice');

-- Kept in the ledger as points are: the member's nights against the venue's nights issued, balanced, in nights.
select results_eq(
  $$ select a.code, a.unit::text, e.amount from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
     join public.ledger_transaction t on t.id = e.transaction_id
     where t.idempotency_key = 'nights.visit:00000000-0000-4000-8000-0000000a1214' order by a.code $$,
  $$ values ('member.nights'::text, 'nights'::text, -250::bigint), ('venue.nights_issued', 'nights', 250) $$,
  'one balanced transaction in nights: the member credited, the venue''s nights issued debited');
select is((select count(*)::integer from public.outbox_event where event_type = 'nights.earned'), 2, 'each earning emits nights.earned');

-- No tier has rewards.accommodation any more: Kunal's ten hours earn nothing.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, effective_from)
select venue_id, id, 'rewards.accommodation', false, now() from public.tier where venue_id = '00000000-0000-4000-8000-000000000001';
select isnt(private.close_visit('00000000-0000-4000-8000-000000000216', pg_temp.at(600), 'door'), null, 'Kunal''s visit closes');
select is(coalesce(pg_temp.nights('216'), 0), 0::bigint, 'and earns no nights without rewards.accommodation');

-- The member sees their nights at the top of Rewards; no one runs the earning by hand.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select points >= 0, nights from public.my_rewards() $$, $$ values (true, 175::bigint) $$,
  'Mihir''s Rewards shows his 175 thousandths of a night');
select throws_ok($$ select private.earn_visit_nights('00000000-0000-4000-8000-0000000a1213') $$, '42501', null,
  'a member cannot earn a visit''s nights by hand');
select throws_ok($$ select private.post_nights('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 1000, 'nights_earned', 'Gift', 'x') $$,
  '42501', null, 'nor post nights');
reset role;

select * from finish();
rollback;
