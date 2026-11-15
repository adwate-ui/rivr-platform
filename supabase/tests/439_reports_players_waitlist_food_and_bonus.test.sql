-- Reports › Players, Waitlist, Food and drink and Bonus (redesign RD-27), over one club day 400 days ago at the club.
-- Seats: Ishaan at Table 2 07:30 to 09:30 and at Table 3 10:00 to 11:00 (two visits), Mihir at Table 3 08:30 to 09:30.
-- Lists: Ishaan joined Table 2's at 07:00 and was seated from it at 07:30; Mihir joined it at 07:10 and left at 07:20; Vihaan joined Table 3's at
-- 08:00 and was seated another way at 08:40; a request the floor declined counts nowhere.
-- Orders: KOT 1 at Table 2, three items, accepted in 2 minutes and served in 10; KOT 2 at Table 2, one item, accepted in 4 minutes; KOT 3 at
-- Table 3, five items, void before anyone accepted it.
-- Bonus: 500 by hand to Ishaan, 1,000 to Mihir for another reason, and 50 of Ishaan's used at his seat.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Long before anything the seed holds.
create temp table day as select private.club_day_of(now()) - 400 as d;
create function pg_temp.at(p_time text) returns timestamptz language sql as $$
  select ((select d from day)::timestamp + p_time::interval) at time zone 'Asia/Kolkata';
$$;
create temp table tbl as select name, id, table_type_id from public.game_table
  where venue_id = '00000000-0000-4000-8000-000000000001' and name in ('Table 2', 'Table 3');
create temp table admin as select id, full_name from public.staff
  where venue_id = '00000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000103';
grant select on day, tbl, admin to authenticated;
grant execute on function pg_temp.at(text) to authenticated;

create function pg_temp.sat(p_visit uuid, p_member uuid, p_table text, p_seat integer, p_from text, p_to text) returns uuid language sql as $$
  insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
  values (p_visit, '00000000-0000-4000-8000-000000000001', p_member, pg_temp.at(p_from) - interval '5 minutes', pg_temp.at(p_to) + interval '5 minutes', 'door')
  on conflict (id) do nothing;
  insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
  select '00000000-0000-4000-8000-000000000001', p_member, p_visit, (select id from tbl where name = p_table), p_seat, pg_temp.at(p_from), pg_temp.at(p_from),
         pg_temp.at(p_to), 'left'
  returning id;
$$;
create temp table seats as
  select pg_temp.sat('00000000-0000-4000-8000-0000000c4391', '00000000-0000-4000-8000-000000000211', 'Table 2', 1, '07:30', '09:30') as ishaan_session;
select pg_temp.sat('00000000-0000-4000-8000-0000000c4392', '00000000-0000-4000-8000-000000000213', 'Table 3', 2, '08:30', '09:30');
select pg_temp.sat('00000000-0000-4000-8000-0000000c4393', '00000000-0000-4000-8000-000000000211', 'Table 3', 3, '10:00', '11:00');

-- Four more came in for the first time that day and did not sit: they are no first visit among those who played, whose share
-- would else pass the whole (the money review of the pull request: 6 of 2 read as 300%).
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', m.id, pg_temp.at('12:00'), pg_temp.at('12:30'), 'door'
from (select id from public.member where venue_id = '00000000-0000-4000-8000-000000000001' and erased_at is null
        and id not in ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000216')
      order by member_number limit 4) m;

-- The lists.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, joined_at, approved_at, status, seated_at, called_at, hold_until, call_table_id, call_seat, left_at, left_reason)
select '00000000-0000-4000-8000-000000000001'::uuid, w.member::uuid, t.table_type_id, t.id, ('00000000-0000-4000-8000-00000c43900' || w.n)::uuid, pg_temp.at(w.joined), pg_temp.at(w.joined), w.status,
       pg_temp.at(w.seated), pg_temp.at(w.seated), pg_temp.at(w.seated) + interval '3 minutes', case when w.seated is null then null else t.id end,
       case when w.seated is null then null else 1 end, pg_temp.at(w.left_at), w.left_reason
from (values (1, '00000000-0000-4000-8000-000000000211', 'Table 2', '07:00', 'seated', '07:30', null, null),
             (2, '00000000-0000-4000-8000-000000000213', 'Table 2', '07:10', 'left', null, '07:20', 'left'),
             (3, '00000000-0000-4000-8000-000000000212', 'Table 3', '08:00', 'left', null, '08:40', 'seated'),
             (4, '00000000-0000-4000-8000-000000000216', 'Table 3', '08:05', 'left', null, '08:06', 'declined'))
       as w(n, member, table_name, joined, status, seated, left_at, left_reason)
join tbl t on t.name = w.table_name;

-- The orders.
insert into public.fnb_order (venue_id, club_day, kot_number, lines, member_id, seat, source, table_id, visit_id, created_at, accepted_at, accepted_by_staff_id,
                              delivered_at, delivered_by_staff_id, cancelled_at, cancel_reason)
select '00000000-0000-4000-8000-000000000001'::uuid, (select d from day), o.kot, o.lines::jsonb, '00000000-0000-4000-8000-000000000211'::uuid, 1, 'console', t.id,
       '00000000-0000-4000-8000-0000000c4391'::uuid, pg_temp.at(o.placed), pg_temp.at(o.accepted), case when o.accepted is null then null else (select id from admin) end,
       pg_temp.at(o.served), case when o.served is null then null else (select id from admin) end, pg_temp.at(o.voided), case when o.voided is null then null else 'Ordered twice' end
from (values (9001, 'Table 2', '[{"item_id": "a", "quantity": 2}, {"item_id": "b", "quantity": 1}]', '08:00', '08:02', '08:10', null),
             (9002, 'Table 2', '[{"item_id": "a", "quantity": 1}]', '08:30', '08:34', null, null),
             (9003, 'Table 3', '[{"item_id": "c", "quantity": 5}]', '09:00', null, null, '09:01'))
       as o(kot, table_name, lines, placed, accepted, served, voided)
join tbl t on t.name = o.table_name;

-- The Bonus: given now, then dated to the day.
create temp table before_bonus as select coalesce(sum(remaining_paise), 0)::bigint as held from public.bonus_grant
  where venue_id = '00000000-0000-4000-8000-000000000001' and expired_at is null;
create temp table grants as
  select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 50000, 'Sorry for the wait', null,
                              'bonus.hand:00000000-0000-4000-8000-0000000c4399') as by_hand,
         private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 100000, 'Welcome back', null, 'c439:welcome') as other;
update public.bonus_grant set created_at = pg_temp.at('08:15') where id in ((select by_hand from grants), (select other from grants));
insert into public.bonus_redemption (venue_id, member_id, session_id, table_id, amount_paise, ledger_transaction_id, created_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', (select ishaan_session from seats), (select id from tbl where name = 'Table 2'), 5000,
       (select g.ledger_transaction_id from public.bonus_grant g where g.id = (select by_hand from grants)), pg_temp.at('08:20');
grant select on before_bonus to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');

-- Players.
select results_eq(
  $$ select figure, amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'players', (select d from day), (select d from day)) order by figure $$,
  $$ values ('check_ins'::text, 7::bigint), ('new_members', 0), ('played', 2), ('session_seconds', 4800) $$,
  'players: seven check-ins, two members who played, nobody new that day, a seat session of an hour and twenty minutes on average');
select results_eq(
  $$ select measure, amount from public.players_report('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) where measure <> 'tier' order by place $$,
  $$ values ('played'::text, 2::bigint), ('first_visit', 2), ('id_checks', 0) $$,
  'the members who played, those of them on a first visit (never more than played), and no ID check done that day');
select is((select sum(amount)::bigint from public.players_report('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) where measure = 'tier'),
          2::bigint, 'and the players by tier add up to them');
select results_eq(
  $$ select extract(hour from bucket at time zone 'Asia/Kolkata')::integer, amount
     from public.report_chart('00000000-0000-4000-8000-000000000001', 'players', (select d from day), (select d from day)) where amount > 0 order by bucket $$,
  $$ values (7, 1::bigint), (8, 1), (9, 1), (12, 4) $$, 'check-ins by the hour');
select is((select count(*)::integer from public.report_chart('00000000-0000-4000-8000-000000000001', 'players', (select d from day), (select d from day))), 24,
          'one club day is twenty-four bars');
select results_eq(
  $$ select ((bucket at time zone 'Asia/Kolkata') - interval '6 hours')::date, amount
     from public.report_chart('00000000-0000-4000-8000-000000000001', 'players', (select d from day) - 1, (select d from day) + 1) order by bucket $$,
  $$ select (select d from day) - 1, 0::bigint union all select (select d from day), 7 union all select (select d from day) + 1, 0 $$,
  'a longer span is a bar a club day');

-- Tables: its chart, the members seated in each hour.
select results_eq(
  $$ select extract(hour from bucket at time zone 'Asia/Kolkata')::integer, amount
     from public.report_chart('00000000-0000-4000-8000-000000000001', 'tables', (select d from day), (select d from day)) where amount > 0 order by bucket $$,
  $$ values (7, 1::bigint), (8, 2), (9, 2), (10, 1) $$, 'seated by the hour, a member once');

-- Waitlist.
select results_eq(
  $$ select figure, amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'waitlist', (select d from day), (select d from day)) order by figure $$,
  $$ values ('joined'::text, 3::bigint), ('longest_seconds', 2400), ('seated', 2), ('wait_seconds', 2100) $$,
  'the waitlist: three joined, two got a seat after 35 minutes on average, 40 at the longest; the declined request is no join');
select results_eq(
  $$ select table_name, joined, seated, left_list, wait_seconds, longest_seconds
     from public.waitlist_report('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) where table_name in ('Table 1', 'Table 2', 'Table 3') order by table_name $$,
  $$ values ('Table 1'::text, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint), ('Table 2', 2, 1, 1, 1800, 1800), ('Table 3', 1, 1, 0, 2400, 2400) $$,
  'each table''s own list, a table nobody joined at nothing');
select results_eq(
  $$ select extract(hour from bucket at time zone 'Asia/Kolkata')::integer, amount
     from public.report_chart('00000000-0000-4000-8000-000000000001', 'waitlist', (select d from day), (select d from day)) where amount > 0 order by bucket $$,
  $$ values (7, 2::bigint), (8, 1) $$, 'joins by the hour');

-- Food and drink.
select results_eq(
  $$ select figure, amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'fnb', (select d from day), (select d from day)) order by figure $$,
  $$ values ('accept_seconds'::text, 180::bigint), ('items', 4), ('orders', 3), ('serve_seconds', 600) $$,
  'food and drink: three orders, four items apart from the void one, three minutes to accept and ten to serve');
select results_eq(
  $$ select grouped_by, label, orders, items, accept_seconds, serve_seconds, voided
     from public.fnb_report('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$,
  $$ select 'table'::text, 'Table 2'::text, 2::bigint, 4::bigint, 180::bigint, 600::bigint, 0::bigint
     union all select 'table', 'Table 3', 1, 0, 0, 0, 1
     union all select 'staff', (select full_name from admin), 2, 4, 180, 600, 0
     union all select 'staff', null, 1, 0, 0, 0, 1 $$,
  'by table, then by who accepted them, with the order nobody accepted on a line of its own');
select results_eq(
  $$ select extract(hour from bucket at time zone 'Asia/Kolkata')::integer, amount
     from public.report_chart('00000000-0000-4000-8000-000000000001', 'fnb', (select d from day), (select d from day)) where amount > 0 order by bucket $$,
  $$ values (8, 2::bigint), (9, 1) $$, 'orders by the hour');

-- Bonus.
select results_eq(
  $$ select figure, amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'bonus', (select d from day), (select d from day)) order by figure $$,
  $$ select 'by_hand'::text, 50000::bigint union all select 'given', 150000
     union all select 'outstanding', (select held from before_bonus) + 150000 union all select 'used', 5000 $$,
  'bonus: what was given, how much of it by hand, what was used, and what members hold now');
select results_eq(
  $$ select source, label, members, grants, given_paise
     from public.bonus_report('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$,
  $$ values ('other'::text, 'Welcome back'::text, 1::bigint, 1::bigint, 100000::bigint), ('hand', null, 1, 1, 50000) $$,
  'by where it came from, the most first: by hand on its own line, anything else by its reason');
select results_eq(
  $$ select extract(hour from bucket at time zone 'Asia/Kolkata')::integer, amount
     from public.report_chart('00000000-0000-4000-8000-000000000001', 'bonus', (select d from day), (select d from day)) where amount > 0 $$,
  $$ values (8, 150000::bigint) $$, 'bonus given by the hour');

-- A promotion's grant is under the promotion's name.
reset role;
insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, source_key, trigger, club_day, chips, cost_paise, effect, bonus_grant_id)
select v.venue_id, v.promotion_id, v.id, '00000000-0000-4000-8000-000000000213', 'c439', 'hours', (select d from day), 1000, 100000, '{}'::jsonb, (select other from grants)
from public.promotion_version v where v.venue_id = '00000000-0000-4000-8000-000000000001' order by v.created_at, v.id limit 1;
create temp table promoted as
  select p.name from public.promotion_grant pg join public.promotion p on p.id = pg.promotion_id where pg.source_key = 'c439';
grant select on promoted to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq(
  $$ select source, label, given_paise from public.bonus_report('00000000-0000-4000-8000-000000000001', (select d from day), (select d from day)) $$,
  $$ select 'promotion'::text, (select name from promoted), 100000::bigint union all select 'hand', null, 50000 $$,
  'a promotion''s grant is under the promotion');

-- The span and the report asked for.
select is((select count(*)::integer from public.report_chart('00000000-0000-4000-8000-000000000001', 'fnb', (select d from day) - 91, (select d from day))), 92,
          '92 days may be asked for, a bar each');
select throws_ok($$ select * from public.report_chart('00000000-0000-4000-8000-000000000001', 'fnb', (select d from day) - 92, (select d from day)) $$, '22023', null, 'and no more');
select throws_ok($$ select * from public.report_figures('00000000-0000-4000-8000-000000000001', 'bonus', (select d from day), (select d from day) - 1) $$, '22023', null, 'nor backwards');
select throws_ok($$ select * from public.report_chart('00000000-0000-4000-8000-000000000001', 'rake', (select d from day), (select d from day)) $$, '22023', null, 'nor a chart nobody named');
select throws_ok($$ select * from public.report_figures('00000000-0000-4000-8000-000000000001', 'tables', (select d from day), (select d from day)) $$, '22023', null, 'nor figures nobody named');
select throws_ok($$ select * from public.bonus_report('00000000-0000-4000-8000-000000000002', (select d from day), (select d from day)) $$, '22023', null,
                 'and the practice venue has no reports');

-- A super admin reads them; every other role is refused, as every report.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select amount from public.report_figures('00000000-0000-4000-8000-000000000001', 'fnb', (select d from day), (select d from day)) where figure = 'orders'), 3::bigint,
          'a super admin reads the reports too');
create function pg_temp.refused(p_who text) returns setof text language sql as $$
  select throws_ok(format('select * from public.%s(%L, %s(select d from day), (select d from day))', f.name, '00000000-0000-4000-8000-000000000001', f.report), '42501', null,
                   p_who || ' reads no ' || f.name || ' ' || f.report)
  from (values ('report_figures', '''players'', '), ('report_figures', '''waitlist'', '), ('report_figures', '''fnb'', '), ('report_figures', '''bonus'', '),
               ('report_chart', '''tables'', '), ('report_chart', '''bonus'', '), ('players_report', ''), ('waitlist_report', ''), ('fnb_report', ''), ('bonus_report', ''))
         as f(name, report);
$$;
grant execute on function pg_temp.refused(text) to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select pg_temp.refused('an investor');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select pg_temp.refused('marketing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select pg_temp.refused('a dealer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select pg_temp.refused('a member');
reset role;
select ok(not has_function_privilege('anon', 'public.' || f, 'execute'), 'nobody signed out runs ' || f)
from unnest(array['report_figures(uuid, text, date, date)', 'report_chart(uuid, text, date, date)', 'players_report(uuid, date, date)',
                  'waitlist_report(uuid, date, date)', 'fnb_report(uuid, date, date)', 'bonus_report(uuid, date, date)']) as f;
select ok(not has_function_privilege('authenticated', 'private.' || f, 'execute'), 'the helper is the definer''s alone: ' || f)
from unnest(array['report_span(date, date)', 'report_buckets(date, date)', 'waitlist_joins(uuid, date, date)', 'fnb_orders_over(uuid, date, date)']) as f;

select * from finish();
rollback;
