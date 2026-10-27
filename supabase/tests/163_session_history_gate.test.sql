-- Session history follows its tier switch (#504). Kunal (216) plays a session on a ₹50,000 marker, which his cash-out
-- settles, then sits again tonight; Arjun (201) owes an open ₹50,000 marker (seed). With sessions.history they read
-- all of it; with it off in their tier, only what is open now: tonight's visit and seat, and a marker still owed.
-- 103 Aditya is the floor manager; 104 Sana a cashier.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.seen() returns table (visits integer, seats integer, cage integer, markers integer, settlements integer)
language sql as $$
  select (select count(*)::integer from public.visit), (select count(*)::integer from public.seat_session),
         (select count(*)::integer from public.cage_transaction), (select count(*)::integer from public.marker),
         (select count(*)::integer from public.marker_settlement);
$$;
grant execute on function pg_temp.seen() to authenticated;

-- Kunal's past session: seated, a marker, cashed out finally, which settles the marker and closes his visit.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.set_credit_limit('00000000-0000-4000-8000-000000000001', '9000000216', 5000000, 'A regular'), 'active', 'Kunal has credit');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 4, '9000000216'),
  null, 'and sits at Table 3');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'History test'), null, 'he may leave early');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt(public.issue_marker('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 5000000,
  'M10 40 C 30 10, 50 70, 70 40', gen_random_uuid()), null, 'Sana issues him ₹50,000 on a marker');
select isnt((select to_member_paise from public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216',
  8000000, 'cash', gen_random_uuid(), true)), null, 'his final cash-out settles it and closes his visit');
-- Tonight he sits again.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 4, '9000000216'),
  null, 'and sits again tonight');
reset role;
create temp table kunal_had as
  select (select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000216') as visits,
         (select count(*)::integer from public.seat_session where member_id = '00000000-0000-4000-8000-000000000216') as seats,
         (select count(*)::integer from public.cage_transaction where member_id = '00000000-0000-4000-8000-000000000216') as cage;
grant select on kunal_had to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select results_eq($$ select visits, seats, cage, markers, settlements from pg_temp.seen() $$,
  $$ select visits, seats, cage, 1, 1 from kunal_had $$, 'with session history, Kunal reads all of his: past and tonight');
reset role;

-- His tier and Arjun's turn session history off.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode)
select distinct m.venue_id, m.tier_id, 'sessions.history', false, 'locked'::public.feature_display_mode from public.member m
where m.id in ('00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-000000000201');

select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select results_eq($$ select visits, seats, cage, markers, settlements from pg_temp.seen() $$, $$ values (1, 1, 0, 0, 0) $$,
  'without it, only tonight''s visit and seat: no past visit or seat, no buy-in or cash-out, no settled marker');
select is((select closed_at from public.visit), null, 'the visit he reads is tonight''s, still open');
select ok((select count(*) from public.my_wallet_movement where table_name = 'Table 3') > 0,
  'his Balance still names the table his marker was at, though he reads no seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is(private.movement_table_name((select ledger_transaction_id from public.marker
                                       where member_id = '00000000-0000-4000-8000-000000000216' limit 1)), null,
  'and no one else learns the table of a transaction that is not theirs');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from public.marker where settled_at is null), 1, 'Arjun still reads the marker he owes');
reset role;

select * from finish();
rollback;
