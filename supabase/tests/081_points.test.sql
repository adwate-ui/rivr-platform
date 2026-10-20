-- Points (#89; decision 0161): a visit earns its points as it closes, for its time at each table at that
-- table type's rate and for its share of the rake, kept in points_earning and credited to the member, so
-- the points reconcile to the ledger and to the seat sessions. Points never convert to cash. Seeded rates:
-- 10 an hour at 100/200 (Table 2), 5 at 50/100 (Table 1), and 5% of rake. Mihir (213) and Yash (214) are
-- members; 103 Aditya an admin, who reads members; 106 Pema a dealer, who does not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- A member's points, as Balance shows them.
create function pg_temp.points(p_member uuid) returns bigint language sql as $$
  select -private.account_balance(a.id) from public.ledger_account a where a.member_id = p_member and a.code = 'member.points';
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
-- Sunday 4 January 2026, 20:00 IST, long before anything seeded.
create function pg_temp.at(p_minutes integer) returns timestamptz language sql as $$
  select '2026-01-04T20:00:00+05:30'::timestamptz + make_interval(mins => p_minutes);
$$;

select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'points.per_hour', 'nlh_100_200', now()) ->> 'points', '10',
  'the seed earns 10 points an hour at 100/200');
select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'points.rewards_rake_share', '', now()) ->> 'basis_points', '500',
  'and 5% of rake');

-- Mihir sits at Table 2 at 20:00, moves to Table 1 at 21:00, is away 30 minutes and leaves at 23:00.
-- Yash sits at Table 2 from 20:00 to 22:00, changing seats there at 20:59.
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000a8901', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', pg_temp.at(0)),
  ('00000000-0000-4000-8000-0000000a8902', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', pg_temp.at(0));
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds)
values ('00000000-0000-4000-8000-0000000b8901', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
        '00000000-0000-4000-8000-0000000a8901', pg_temp.table_id('Table 1'), 1, pg_temp.at(0), pg_temp.at(60), pg_temp.at(180), 'left', 1800),
       ('00000000-0000-4000-8000-0000000b8902', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214',
        '00000000-0000-4000-8000-0000000a8902', pg_temp.table_id('Table 2'), 3, pg_temp.at(0), pg_temp.at(59), pg_temp.at(120), 'left', 0);
insert into public.seat_move (venue_id, session_id, from_table_id, from_seat, to_table_id, to_seat, created_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b8901', pg_temp.table_id('Table 2'), 1,
        pg_temp.table_id('Table 1'), 1, pg_temp.at(60)),
       ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000b8902', pg_temp.table_id('Table 2'), 2,
        pg_temp.table_id('Table 2'), 3, pg_temp.at(59));

-- Hands: ₹300 of rake at Table 2 at 20:30 (both seated), ₹350 there at 21:30 (Yash alone), ₹1,000 at Table 1
-- at 22:00 (Mihir alone).
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e891', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000008901');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d891', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet P', '00000000-0000-4000-8000-00000000e891');
-- A down long over, so the seeded floor's open down for Pema stands.
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-00000000c891', '00000000-0000-4000-8000-000000000001', pg_temp.table_id('Table 2'), s.id,
       '00000000-0000-4000-8000-00000000d891', pg_temp.at(0), pg_temp.at(240)
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001';
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied,
                         played_at, idempotency_key)
select d.venue_id, pg_temp.table_id(h.table_name), d.id, d.staff_id, d.device_id, 'holdem', h.pot, h.rake, 0, false, pg_temp.at(h.minute), h.request
from public.dealer_down d
cross join (values ('Table 2', 600000::bigint, 30000::bigint, 30, 'points-hand-1'), ('Table 2', 700000::bigint, 35000::bigint, 90, 'points-hand-2'),
                   ('Table 1', 2000000::bigint, 100000::bigint, 120, 'points-hand-3')) as h (table_name, pot, rake, minute, request)
where d.id = '00000000-0000-4000-8000-00000000c891';

-- Mihir leaves at 23:00: his visit closes and earns its points.
select isnt(private.close_visit('00000000-0000-4000-8000-000000000213', pg_temp.at(180), 'door'), null, 'Mihir''s visit closes');
select results_eq(
  $$ select e.basis, g.name, e.played_seconds, e.rake_share_paise, e.rate, e.points
     from public.points_earning e left join public.game_table g on g.id = e.table_id
     where e.visit_id = '00000000-0000-4000-8000-0000000a8901' order by e.basis, e.played_seconds $$,
  $$ values ('hours', 'Table 2', 3000::bigint, null::bigint, 10, 8::bigint), ('hours', 'Table 1', 6000::bigint, null::bigint, 5, 8::bigint),
            ('rake', null, null::bigint, 115000::bigint, 500, 57::bigint) $$,
  'an hour at Table 2 and two at Table 1, 2 h 30 min played: 8 points each; a ₹1,150 share of rake at 5%: 57 points');
select is(pg_temp.points('00000000-0000-4000-8000-000000000213'), 73::bigint, 'his points rise by 73');
select is((select sum(e.played_seconds)::bigint from public.points_earning e where e.visit_id = '00000000-0000-4000-8000-0000000a8901'),
          (select floor(extract(epoch from (s.ended_at - s.started_at)))::bigint - s.away_seconds from public.seat_session s
           where s.id = '00000000-0000-4000-8000-0000000b8901'),
  'the time earned on is his seat session''s time played');
select is((select sum(e.points)::bigint from public.points_earning e where e.member_id = '00000000-0000-4000-8000-000000000213'),
          pg_temp.points('00000000-0000-4000-8000-000000000213'), 'and his points reconcile to the ledger');
select is_empty($$ select 1 from public.ledger_transaction t join public.ledger_entry n on n.transaction_id = t.id
                   join public.ledger_account a on a.id = n.account_id
                   where t.idempotency_key = 'points.visit:00000000-0000-4000-8000-0000000a8901' and a.unit <> 'points' $$,
  'points move between points accounts only, never cash');
select is((select (payload ->> 'points')::integer from public.outbox_event where event_type = 'points.earned'
           and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000213'), 73, 'points.earned goes out with the 73');

-- Earned once, however often the visit is closed or earned.
select is(private.earn_visit_points('00000000-0000-4000-8000-0000000a8901'), 0::bigint, 'earning the visit again earns nothing');
select is(private.close_visit('00000000-0000-4000-8000-000000000213', now(), 'door'), null, 'nor does closing it again');
select is(pg_temp.points('00000000-0000-4000-8000-000000000213'), 73::bigint, 'he still has 73');

-- Yash: two hours at Table 2 across a seat change, rounded once for the table, 20 points (59 and 61 minutes
-- rounded apart would be 9 and 10); ₹150 and ₹350 of rake, ₹500 at 5%, 25 points.
select private.close_visit('00000000-0000-4000-8000-000000000214', pg_temp.at(130), 'cash_out');
select results_eq($$ select g.name, e.played_seconds, e.points from public.points_earning e join public.game_table g on g.id = e.table_id
                     where e.visit_id = '00000000-0000-4000-8000-0000000a8902' $$,
  $$ values ('Table 2', 7200::bigint, 20::bigint) $$, 'a seat change at the same table adds up before rounding');
select is(pg_temp.points('00000000-0000-4000-8000-000000000214'), 45::bigint, 'Yash earns 20 for his hours and 25 from rake');

-- Ritika (215) is still seated at Table 5 when her visit closes an hour in: the seat counts to the close.
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000a8903', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', pg_temp.at(0));
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-0000000a8903',
        pg_temp.table_id('Table 5'), 1, pg_temp.at(0), pg_temp.at(0));
select private.close_visit('00000000-0000-4000-8000-000000000215', pg_temp.at(60), 'door');
select is(pg_temp.points('00000000-0000-4000-8000-000000000215'), 10::bigint, 'a seat still open at the close earns its hour, 10 points');

-- The practice venue earns its own members points, inside it.
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000a8904', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', pg_temp.at(0));
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-0000000a8904', g.id, 1,
       pg_temp.at(0), pg_temp.at(0), pg_temp.at(60), 'left'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000002' and g.name = 'Table 2';
select private.close_visit('00000000-0000-4000-8000-000000000301', pg_temp.at(60), 'door');
select results_eq($$ select venue_id, points from public.points_earning where visit_id = '00000000-0000-4000-8000-0000000a8904' order by basis $$,
  $$ values ('00000000-0000-4000-8000-000000000002'::uuid, 10::bigint), ('00000000-0000-4000-8000-000000000002'::uuid, 0::bigint) $$,
  'an hour at the practice Table 2 earns 10 points there');
select is(pg_temp.points('00000000-0000-4000-8000-000000000301'), 10::bigint, 'credited to his practice account');

-- Points leave only through a redemption, never below nothing.
select throws_ok($$ select private.debit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 74,
  'A seat', 'points-redeem-1') $$, 'RVPTS', null, '74 points cannot be taken from 73');
select lives_ok($$ select private.debit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 20,
  'A seat', 'points-redeem-2') $$, 'but 20 can');
select lives_ok($$ select private.debit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 20,
  'A seat', 'points-redeem-2') $$, 'and the same request again is the same redemption');
select is(pg_temp.points('00000000-0000-4000-8000-000000000213'), 53::bigint, 'leaving him 53');
select throws_ok($$ select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 0,
  'Nothing', 'points-nothing') $$, '22023', null, 'no one is credited nothing');

-- Who sees what was earned: points history is rewards.points_history, here given to Yash and taken from Mihir.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'rewards.points_history', true, 'Test'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 'rewards.points_history', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.points_earning where member_id in ('00000000-0000-4000-8000-000000000213',
  '00000000-0000-4000-8000-000000000214')), 5, 'an admin who reads members sees both visits'' earnings');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.points_earning $$, 'a dealer sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select is_empty($$ select 1 from public.points_earning where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'a practice member sees nothing of the club''s');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select 1 from public.points_earning $$, 'Mihir, without points history, sees none of his');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select results_eq($$ select member_id, count(*)::integer from public.points_earning group by member_id $$,
  $$ values ('00000000-0000-4000-8000-000000000214'::uuid, 2) $$, 'Yash, with points history, sees his own two and no one else''s');
select throws_ok($$ update public.points_earning set points = 1000 $$, '42501', null, 'and changes none');
select throws_ok($$ select private.earn_visit_points('00000000-0000-4000-8000-0000000a8901') $$, '42501', null,
  'nor earns points himself');
select throws_ok($$ select private.credit_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 1000,
  'Free', 'points-free') $$, '42501', null, 'nor credits them');
reset role;
select throws_ok($$ update public.points_earning set points = 1000 $$, '42501', null, 'an earning is never changed');

select * from finish();
rollback;
