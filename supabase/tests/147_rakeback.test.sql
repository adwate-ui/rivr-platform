-- Hourly rakeback (#108; question #485; decision 0245). Last week Mihir (213) and Yash (214) sat at Table 2 (100/200)
-- for two hours, through two hands of ₹3,000 and ₹2,000 rake; Kunal (216) sat alone at Table 1 (50/100) through a hand
-- of ₹1,000. A live promotion gives 10% rakeback at 100/200 only. On Monday each of Mihir and Yash has ₹2,500 of rake
-- at Table 2 and is given ₹250 of bonus; Kunal's stake has no rule and gets none. A second run gives nothing again; a
-- frozen member is given his once released. The week is the club's, Monday 06:00 IST to Monday 06:00 IST.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.at(p_minutes integer) returns timestamptz language sql as $$
  select (select week_from from private.rakeback_week(now())) + interval '2 days' + make_interval(mins => p_minutes);
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;

-- The club's week: from the Monday 06:00 IST before, to the Monday 06:00 IST after.
select results_eq($$ select * from private.rakeback_week('2026-11-02 06:00 +05:30') $$,
  $$ values ('2026-10-26 06:00 +05:30'::timestamptz, '2026-11-02 06:00 +05:30'::timestamptz) $$, 'Monday 06:00 IST starts a week');
select results_eq($$ select * from private.rakeback_week('2026-11-02 05:59 +05:30') $$,
  $$ values ('2026-10-19 06:00 +05:30'::timestamptz, '2026-10-26 06:00 +05:30'::timestamptz) $$, 'and a minute before, the week before still runs');
select ok(exists (select 1 from cron.job where jobname = 'rakeback-weekly' and schedule = '30 0 * * 1'),
  'it runs each Monday at 06:00 IST (00:30 UTC)');

-- Last week: the seats, and the hands with their rake.
insert into public.visit (id, venue_id, member_id, opened_at) values
  ('00000000-0000-4000-8000-0000000a1471', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', pg_temp.at(0)),
  ('00000000-0000-4000-8000-0000000a1472', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', pg_temp.at(0)),
  ('00000000-0000-4000-8000-0000000a1473', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', pg_temp.at(0));
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, away_seconds) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-0000000a1471', pg_temp.table_id('Table 2'),
   1, pg_temp.at(0), pg_temp.at(0), pg_temp.at(120), 'left', 0),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-0000000a1472', pg_temp.table_id('Table 2'),
   2, pg_temp.at(0), pg_temp.at(0), pg_temp.at(120), 'left', 0),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-0000000a1473', pg_temp.table_id('Table 1'),
   1, pg_temp.at(0), pg_temp.at(0), pg_temp.at(120), 'left', 0);
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e147', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001471');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d147', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet RB', '00000000-0000-4000-8000-00000000e147');
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-00000000c147', '00000000-0000-4000-8000-000000000001', pg_temp.table_id('Table 2'), s.id,
       '00000000-0000-4000-8000-00000000d147', pg_temp.at(0), pg_temp.at(240)
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001';
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied, played_at, idempotency_key)
select d.venue_id, pg_temp.table_id(h.table_name), d.id, d.staff_id, d.device_id, 'holdem', h.pot, h.rake, 0, false, pg_temp.at(h.minute), h.request
from public.dealer_down d
cross join (values ('Table 2', 6000000::bigint, 300000::bigint, 30, 'rakeback-hand-1'), ('Table 2', 4000000::bigint, 200000::bigint, 90, 'rakeback-hand-2'),
                   ('Table 1', 2000000::bigint, 100000::bigint, 60, 'rakeback-hand-3')) as h (table_name, pot, rake, minute, request)
where d.id = '00000000-0000-4000-8000-00000000c147';

select results_eq(
  $$ select right(member_id::text, 3), (select name from public.game_table where id = table_id), share_paise
     from private.week_rake_shares('00000000-0000-4000-8000-000000000001', (select week_from from private.rakeback_week(now())),
                                   (select week_to from private.rakeback_week(now())))
     order by 1 $$,
  $$ values ('213'::text, 'Table 2'::text, 250000::bigint), ('214', 'Table 2', 250000), ('216', 'Table 1', 100000) $$,
  'each member''s rake for the week at each table: each hand split among those seated');

-- Nothing is weighed until a live promotion has a rake_week rule.
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', now()), 0, 'no rakeback promotion, no rakeback');
update public.promotion set status = 'draft' where venue_id = '00000000-0000-4000-8000-000000000001' and status = 'live';
with p as (insert into public.promotion (venue_id, name, status) values ('00000000-0000-4000-8000-000000000001', 'Hourly rakeback', 'live') returning id)
insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
select '00000000-0000-4000-8000-000000000001', id, 'rake_week', '{"stakes": ["nlh_100_200"]}', '{"kind": "bonus", "percent_bps": 1000, "expires_days": 7}'
from p;

-- Yash is frozen this Monday: Mihir is given his, Yash not yet.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000214', 'Test freeze');
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', now()), 1, 'Mihir is given his rakeback, the frozen Yash not');
select results_eq(
  $$ select amount_paise, reason from public.bonus_grant where member_id = '00000000-0000-4000-8000-000000000213' and reason = 'Hourly rakeback' $$,
  $$ values (25000::bigint, 'Hourly rakeback'::text) $$, '10% of his ₹2,500 at 100/200: ₹250 of bonus');
select ok(not exists (select 1 from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
                      where p.name = 'Hourly rakeback' and g.member_id = '00000000-0000-4000-8000-000000000216'),
  'Kunal''s 50/100 has no rakeback rule: nothing for him');
update public.control_state set released_at = now(), release_reason = 'Test over',
  released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001')
where member_id = '00000000-0000-4000-8000-000000000214' and released_at is null;
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', now()), 1, 'released, Yash is given his');
select is(private.give_rakeback('00000000-0000-4000-8000-000000000001', now()), 0, 'and a run again gives no one anything twice');
select is((select count(*)::integer from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
           where p.name = 'Hourly rakeback' and g.trigger = 'rake_week'
             and g.source_key = 'rake_week:' || to_char((select week_from from private.rakeback_week(now())) at time zone 'Asia/Kolkata', 'YYYY-MM-DD')
                                || ':' || pg_temp.table_id('Table 2')), 2, 'each keyed by the week and the table');

-- Only the scheduler runs it.
set local role authenticated;
select throws_ok($$ select private.give_rakeback('00000000-0000-4000-8000-000000000001', now()) $$, '42501', null, 'no one signed in runs it');
reset role;

select * from finish();
rollback;
