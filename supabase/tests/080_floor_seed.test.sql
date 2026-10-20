-- The design prompt's floor in the seed (#54; design prompt section 5), in both venues, with the clock
-- at 00:10 when the seed ran: Pema Lepcha deals Table 3 from 23:40; Kabir Sethi (23:52), Naina Kapoor
-- (23:58) and Rohan Bhatia (00:07) wait for 100/200 and nobody for 50/100; the jackpot opened at
-- ₹3,42,600; tonight's high hand is four of a kind, queens, Table 2, 22:18, ₹2,000, dealt by Pema in
-- her down there from 21:40 to 23:20. Times are read against Pema's down at Table 3, the seed's 23:40.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Each venue's seeded down at Table 3, from the seed's tablet there.
create temp table t3 on commit drop as
select d.venue_id, v.slug, d.started_at, d.staff_id from public.dealer_down d join public.venue v on v.id = d.venue_id
where d.device_id in ('00000000-0000-4000-8000-000000005d31', '00000000-0000-4000-8000-000000005d32');

select results_eq(
  $$ select t3.slug, s.full_name, t.name from t3 join public.staff s on s.id = t3.staff_id
     join public.dealer_down d on d.staff_id = t3.staff_id and d.started_at = t3.started_at join public.game_table t on t.id = d.table_id
     order by t3.slug $$,
  $$ values ('gurugram', 'Pema Lepcha', 'Table 3'), ('practice', 'Pema Lepcha', 'Table 3') $$,
  'Pema Lepcha deals Table 3 in both venues, on its tablet');

select results_eq(
  $$ select t3.slug, m.full_name, (extract(epoch from e.joined_at - t3.started_at) / 60)::integer
     from public.waitlist_entry e join public.table_type tt on tt.id = e.table_type_id and tt.code = 'nlh_100_200'
     join public.member m on m.id = e.member_id join t3 on t3.venue_id = e.venue_id
     where e.joined_at <= t3.started_at + interval '30 minutes'
     order by t3.slug, e.joined_at $$,
  $$ values ('gurugram', 'Kabir Sethi', 12), ('gurugram', 'Naina Kapoor', 18), ('gurugram', 'Rohan Bhatia', 27),
            ('practice', 'Kabir Sethi', 12), ('practice', 'Naina Kapoor', 18), ('practice', 'Rohan Bhatia', 27) $$,
  '100/200: Kabir at 23:52, Naina at 23:58, Rohan at 00:07, in both venues');
select is_empty(
  $$ select 1 from public.waitlist_entry e join public.table_type tt on tt.id = e.table_type_id and tt.code = 'nlh_50_100'
     join t3 on t3.venue_id = e.venue_id where e.joined_at <= t3.started_at + interval '30 minutes' $$,
  '50/100: nobody, in either venue');

select results_eq(
  $$ select v.slug, e.amount from public.ledger_transaction x join public.ledger_entry e on e.transaction_id = x.id
     join public.ledger_account a on a.id = e.account_id and a.code = 'venue.jackpot.main' join public.venue v on v.id = x.venue_id
     where x.idempotency_key in ('seed:jackpot:main', 'seed:practice:jackpot:main') order by v.slug $$,
  $$ values ('gurugram', -34260000::bigint), ('practice', -34260000::bigint) $$,
  'the jackpot opens at ₹3,42,600 in both venues');

select results_eq(
  $$ select t3.slug, c.status::text, c.category::text, c.rank, t.name, c.payout_paise, s.full_name,
            (extract(epoch from t3.started_at - h.played_at) / 60)::integer, h.drop_paise
     from public.high_hand_claim c join public.hand h on h.id = c.hand_id and h.idempotency_key = 'seed:high-hand'
     join public.game_table t on t.id = h.table_id join public.staff s on s.id = c.dealer_staff_id join t3 on t3.venue_id = h.venue_id
     order by t3.slug $$,
  $$ values ('gurugram', 'approved', 'four_of_a_kind', 'Q', 'Table 2', 200000::bigint, 'Pema Lepcha', 82, 0::bigint),
            ('practice', 'approved', 'four_of_a_kind', 'Q', 'Table 2', 200000::bigint, 'Pema Lepcha', 82, 0::bigint) $$,
  'tonight''s high hand: four of a kind, queens, Table 2, 22:18, paid ₹2,000, dealt by Pema; nothing dropped into the jackpot');

select results_eq(
  $$ select t3.slug, (extract(epoch from t3.started_at - d.started_at) / 60)::integer, (extract(epoch from t3.started_at - d.ended_at) / 60)::integer,
            c.variance_paise
     from public.hand h join public.dealer_down d on d.id = h.down_id join public.down_count c on c.down_id = d.id
     join t3 on t3.venue_id = h.venue_id where h.idempotency_key = 'seed:high-hand' order by t3.slug $$,
  $$ values ('gurugram', 120, 20, 0::bigint), ('practice', 120, 20, 0::bigint) $$,
  'her down at Table 2 ran from 21:40 to 23:20, its drop box as logged');

select results_eq(
  $$ select v.slug, count(*)::integer from public.dealer_down d join public.venue v on v.id = d.venue_id
     where d.device_id in ('00000000-0000-4000-8000-000000005d21', '00000000-0000-4000-8000-000000005d31',
                           '00000000-0000-4000-8000-000000005d22', '00000000-0000-4000-8000-000000005d32')
     group by v.slug order by v.slug $$,
  $$ values ('gurugram', 2), ('practice', 2) $$, 'two downs on the seeded tablets in each venue, however often the seed runs');

select * from finish();
rollback;
