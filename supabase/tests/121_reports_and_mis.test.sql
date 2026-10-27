-- Reports and the monthly investor MIS (#99; decision 0188). February 2026's club month runs from 06:00
-- IST on 1 February to 06:00 on 1 March. At Table 2, Pema (106) deals a hand at 05:00 on 1 February
-- (January's last club day), Hold'em at 07:00 (₹1,000 rake, ₹100 drop), PLO on the 14th (₹1,500), Hold'em
-- at 05:00 on 1 March (₹500, still February's) and one at 07:00 (March's). The ledger takes ₹3,000 of rake
-- and gives ₹200 of bonus in February, and ₹700 of rake in March. Kavya (290) visits twice in February.
-- Tonight Pema deals a bomb pot at Table 5 (₹250 rake). 103 Aditya is an admin at the club and the
-- practice venue; 191 Nisha an admin at the club only; 190 Farhan the front desk (reads no reports).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.hand(p_at timestamptz, p_variant public.hand_variant, p_rake bigint, p_drop bigint) returns void language sql as $$
  insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied,
                           played_at, idempotency_key)
  select d.venue_id, d.table_id, d.id, d.staff_id, d.device_id, p_variant, 1000000, p_rake, p_drop, false, p_at, 'mis-hand:' || p_at
  from public.dealer_down d where d.id = '00000000-0000-4000-8000-00000000c121';
$$;
create function pg_temp.post(p_kind text, p_at timestamptz, p_debit text, p_credit text, p_paise bigint) returns void language sql as $$
  with posted as (
    insert into public.ledger_transaction (venue_id, kind, idempotency_key, occurred_at)
    values ('00000000-0000-4000-8000-000000000001', p_kind, 'mis-test:' || p_kind || ':' || p_at, p_at) returning id
  )
  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select '00000000-0000-4000-8000-000000000001', posted.id, a.id, case when a.code = p_debit then p_paise else -p_paise end
  from posted, public.ledger_account a
  where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.member_id is null and a.code in (p_debit, p_credit);
$$;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e121', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001211');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d121', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet M', '00000000-0000-4000-8000-00000000e121');
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-00000000c121', '00000000-0000-4000-8000-000000000001', g.id, s.id, '00000000-0000-4000-8000-00000000d121',
       '2026-01-31T20:00:00+05:30', '2026-03-02T00:00:00+05:30'
from public.staff s cross join public.game_table g
where s.user_id = '00000000-0000-4000-8000-000000000106' and s.venue_id = '00000000-0000-4000-8000-000000000001'
  and g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';
select pg_temp.hand('2026-02-01T05:00:00+05:30', 'holdem', 50000, 0);
select pg_temp.hand('2026-02-01T07:00:00+05:30', 'holdem', 100000, 10000);
select pg_temp.hand('2026-02-14T22:00:00+05:30', 'plo', 150000, 0);
select pg_temp.hand('2026-03-01T05:00:00+05:30', 'holdem', 50000, 0);
select pg_temp.hand('2026-03-01T07:00:00+05:30', 'holdem', 50000, 0);
insert into public.dealer_down (id, venue_id, table_id, staff_id, device_id, started_at, ended_at)
select '00000000-0000-4000-8000-00000000c122', d.venue_id, g.id, d.staff_id, d.device_id, now() - interval '2 minutes', now() + interval '1 hour'
from public.dealer_down d join public.game_table g on g.venue_id = d.venue_id and g.name = 'Table 5'
where d.id = '00000000-0000-4000-8000-00000000c121';
insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise, is_cap_applied,
                         played_at, idempotency_key)
select d.venue_id, d.table_id, d.id, d.staff_id, d.device_id, 'bomb_pot', 500000, 25000, 0, false, now(), 'mis-hand:tonight'
from public.dealer_down d where d.id = '00000000-0000-4000-8000-00000000c122';
select pg_temp.post('hand_rake', '2026-02-10T23:00:00+05:30', 'venue.chips_outstanding', 'venue.rake', 300000);
select pg_temp.post('bonus', '2026-02-11T23:00:00+05:30', 'venue.bonus_expense', 'venue.chips_outstanding', 20000);
select pg_temp.post('hand_rake', '2026-03-01T07:30:00+05:30', 'venue.chips_outstanding', 'venue.rake', 70000);
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000290', '2026-02-05T20:00:00+05:30', '2026-02-06T02:00:00+05:30', 'door'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000290', '2026-02-06T20:00:00+05:30', '2026-02-07T02:00:00+05:30', 'door');

-- Who may.
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select throws_ok($$ select * from public.rake_tonight('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'the front desk reads no reports');
select throws_ok($$ select * from public.mis_report_for('00000000-0000-4000-8000-000000000001', '2026-02-01') $$, '42501', null, 'nor the MIS');

-- Tonight.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select * from public.rake_tonight('00000000-0000-4000-8000-000000000001') $$, 'Aditya reads tonight''s rake');
select results_eq($$ select dimension, label, hands::integer, rake_paise from public.rake_tonight('00000000-0000-4000-8000-000000000001')
                     where (dimension = 'table' and label = 'Table 5') or (dimension = 'variant' and key = 'bomb_pot') order by dimension $$,
  $$ values ('table'::text, 'Table 5'::text, 1, 25000::bigint), ('variant', 'bomb_pot', 1, 25000) $$,
  'tonight''s bomb pot by its table and its game');

-- February, before it is stored: a preview.
select is((select is_preview from public.mis_report_for('00000000-0000-4000-8000-000000000001', '2026-02-01')), true, 'February is a preview until stored');
-- Kept as Aditya read it (his claims stay set; a temporary table is the database owner's to make).
reset role;
create temporary table february as select report from public.mis_report_for('00000000-0000-4000-8000-000000000001', '2026-02-01');
-- Pema deals the seed's hand tonight too: her row holds each hand she dealt tonight, and none from February.
select results_eq($$ select hands::integer, rake_paise from public.rake_tonight('00000000-0000-4000-8000-000000000001') r
                     join public.staff s on s.id::text = r.key
                     where r.dimension = 'dealer' and s.user_id = '00000000-0000-4000-8000-000000000106' $$,
  $$ select count(*)::integer, sum(h.rake_paise)::bigint from public.hand h join public.staff s on s.id = h.staff_id
     where s.user_id = '00000000-0000-4000-8000-000000000106' and h.venue_id = '00000000-0000-4000-8000-000000000001'
       and h.played_at >= private.tonight_began(now()) $$,
  'and by its dealer, with her other hands tonight and none from February');
select is((select (report ->> 'hands')::integer from february), 3, 'February''s club month holds the 07:00 hand, the 14th''s and 1 March''s 05:00');
select is((select (report ->> 'rake_paise')::bigint from february), 300000::bigint, 'their rake is ₹3,000');
select is((select (report ->> 'drop_paise')::bigint from february), 10000::bigint, 'and their drop ₹100');
select results_eq($$ select r ->> 'key', (r ->> 'hands')::integer, (r ->> 'rake_paise')::bigint from february, jsonb_array_elements(report -> 'rake_by_variant') r $$,
  $$ values ('holdem'::text, 2, 150000::bigint), ('plo', 1, 150000) $$, 'by variant, the most rake first, then by name');
select results_eq($$ select r ->> 'label', (r ->> 'hands')::integer from february, jsonb_array_elements(report -> 'rake_by_table') r $$,
  $$ values ('Table 2'::text, 3) $$, 'by table');
select is((select count(*)::integer from february, jsonb_array_elements(report -> 'rake_by_dealer') r
           where r ->> 'key' = (select s.id::text from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000106'
                                 and s.venue_id = '00000000-0000-4000-8000-000000000001')), 1, 'and by dealer');
select results_eq($$ select (report ->> 'revenue_paise')::bigint, (report ->> 'expense_paise')::bigint, (report ->> 'net_paise')::bigint from february $$,
  $$ values (300000::bigint, 20000::bigint, 280000::bigint) $$, 'the ledger: ₹3,000 of rake revenue, ₹200 of bonus expense, ₹2,800 net; March''s rake not');
select results_eq($$ select r ->> 'code', (r ->> 'paise')::bigint from february, jsonb_array_elements(report -> 'revenue') r $$,
  $$ values ('venue.rake'::text, 300000::bigint) $$, 'revenue by account');
select results_eq($$ select r ->> 'code', (r ->> 'paise')::bigint from february, jsonb_array_elements(report -> 'expenses') r $$,
  $$ values ('venue.bonus_expense'::text, 20000::bigint) $$, 'expenses by account');
select results_eq($$ select (report ->> 'visits')::integer, (report ->> 'members')::integer from february $$, $$ values (2, 1) $$,
  'two visits, by one member');

-- Stored on the 1st, once.
reset role;
select ok(exists (select 1 from cron.job where jobname = 'monthly-mis' and schedule = '30 1 * * *'), 'pg_cron stores the MIS each morning at 07:00 IST');
select is(private.store_mis('2026-02-01'), (select count(*)::integer from public.venue where not is_practice), 'each venue''s February is stored, not the practice venue''s');
select is_empty($$ select 1 from public.mis_report where venue_id = '00000000-0000-4000-8000-000000000002' $$, 'none for the practice venue');
select is(private.store_mis('2026-02-01'), 0, 'and only once');
select is(private.store_mis(), (select count(*)::integer from public.venue where not is_practice), 'the morning run stores the last month that has ended');
select ok(exists (select 1 from public.mis_report where venue_id = '00000000-0000-4000-8000-000000000001'
                    and month = (date_trunc('month', (now() at time zone 'Asia/Kolkata') - interval '6 hours') - interval '1 month')::date),
  'which is last month');
select is(private.store_mis(), 0, 'and the next morning''s run finds it stored');
select pg_temp.post('bonus', '2026-02-20T23:00:00+05:30', 'venue.bonus_expense', 'venue.chips_outstanding', 5000);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select is_preview, generated_at is not null, (report ->> 'expense_paise')::bigint
                     from public.mis_report_for('00000000-0000-4000-8000-000000000001', '2026-02-01') $$,
  $$ values (false, true, 20000::bigint) $$, 'once stored, February says what it said, though a late posting came in');

select throws_ok($$ select * from public.mis_report_for('00000000-0000-4000-8000-000000000001', '2026-02-02') $$, '22023', null, 'a month by its first day');
select throws_ok($$ select * from public.mis_report_for('00000000-0000-4000-8000-000000000001',
                    (date_trunc('month', (now() at time zone 'Asia/Kolkata') - interval '6 hours') + interval '1 month')::date) $$,
  '22023', null, 'not next month, which is still to come');
select throws_ok($$ select * from public.rake_tonight('00000000-0000-4000-8000-000000000002') $$, '22023', null, 'the practice venue has no reports');

-- Another venue's: Nisha reads the club's reports only.
reset role;
insert into public.mis_report (venue_id, month, report) values ('00000000-0000-4000-8000-000000000002', '2026-01-01', '{}');
select pg_temp.as_person('00000000-0000-4000-8000-000000000191');
select lives_ok($$ select * from public.rake_tonight('00000000-0000-4000-8000-000000000001') $$, 'Nisha reads the club''s');
select throws_ok($$ select * from public.mis_report_for('00000000-0000-4000-8000-000000000002', '2026-01-01') $$, '42501', null, 'not the practice venue''s');
select is_empty($$ select 1 from public.mis_report where venue_id = '00000000-0000-4000-8000-000000000002' $$, 'nor sees its stored MIS');
select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select is_empty($$ select 1 from public.mis_report $$, 'and the front desk sees none');

-- Promotion cost and cohort retention (#111; decision 0235). A promotion capped at ₹1,000 gives ₹500 on 10 February,
-- ₹300 on 25 January and ₹200 on 1 March (March's); another gives only in January. Devansh (296), Vihaan (212) and
-- Ritika (215) first visit in January. Devansh comes back at 05:00 on 1 March, still February's club month; Vihaan at
-- 07:00 on 1 February, February's too; Ritika does not: two of three, 66%. 216's first visit, in August 2025, is older
-- than the six months. Kavya's first visit is February's.
reset role;
create temporary table promo as
  select p.id, p.name, r.id as rule_id, r.trigger from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
  where p.venue_id = '00000000-0000-4000-8000-000000000001' order by p.created_at, p.id, r.id limit 1;
create temporary table other_promo as
  select p.id, r.id as rule_id, r.trigger from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.id <> (select id from promo) order by p.created_at, p.id, r.id limit 1;
insert into public.promotion_budget (venue_id, promotion_id, cap_paise)
select '00000000-0000-4000-8000-000000000001', id, 100000 from promo
on conflict (promotion_id) do update set cap_paise = excluded.cap_paise, cap_count = null;
insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, trigger, effect, cost_paise, points, source_key, club_day)
select '00000000-0000-4000-8000-000000000001'::uuid, p.id, p.rule_id, '00000000-0000-4000-8000-000000000290'::uuid, p.trigger, '{}'::jsonb, g.cost, 0,
       g.source_key, g.club_day
from promo p, (values (50000::bigint, 'mis-test:feb', '2026-02-10'::date), (30000, 'mis-test:jan', '2026-01-25'), (20000, 'mis-test:mar', '2026-03-01'))
  as g (cost, source_key, club_day)
union all
select '00000000-0000-4000-8000-000000000001'::uuid, o.id, o.rule_id, '00000000-0000-4000-8000-000000000290'::uuid, o.trigger, '{}'::jsonb, 40000::bigint,
       0, 'mis-test:other', '2026-01-15'::date
from other_promo o;
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000296', '2026-01-10T20:00:00+05:30', '2026-01-11T01:00:00+05:30', 'door'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000296', '2026-03-01T05:00:00+05:30', '2026-03-01T05:30:00+05:30', 'door'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', '2026-01-20T20:00:00+05:30', '2026-01-21T01:00:00+05:30', 'door'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', '2026-02-01T07:00:00+05:30', '2026-02-01T09:00:00+05:30', 'door'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', '2026-01-25T20:00:00+05:30', '2026-01-26T01:00:00+05:30', 'door'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '2025-08-20T20:00:00+05:30', '2025-08-21T01:00:00+05:30', 'door'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', '2026-02-20T20:00:00+05:30', '2026-02-21T01:00:00+05:30', 'door');
create temporary table february_now as select private.mis_for('00000000-0000-4000-8000-000000000001', '2026-02-01') as report;
select results_eq($$ select r ->> 'id', r ->> 'name', (r ->> 'grants')::integer, (r ->> 'cost_paise')::bigint, (r ->> 'cost_to_date_paise')::bigint,
                            (r ->> 'budget_paise')::bigint, r -> 'budget_grants'
                     from february_now, jsonb_array_elements(report -> 'promotions') r $$,
  $$ select id::text, name, 1, 50000::bigint, 80000::bigint, 100000::bigint, 'null'::jsonb from promo $$,
  'promotion cost: one grant of ₹500 in February, ₹800 to its end (not March''s ₹200), against its ₹1,000 cap; the January-only promotion is not this month''s');
select results_eq($$ select r ->> 'month', (r ->> 'members')::integer, r -> 'months' from february_now, jsonb_array_elements(report -> 'cohorts') r $$,
  $$ values ('2026-02-01'::text, 1, '[{"month": "2026-02-01", "percent": 100, "returned": 1}]'::jsonb),
            ('2026-01-01', 3, '[{"month": "2026-01-01", "percent": 100, "returned": 3}, {"month": "2026-02-01", "percent": 66, "returned": 2}]') $$,
  'cohorts by month of first visit: February''s Kavya; January''s three, two back in February (66%, rounded down), one at 05:00 on 1 March and one at 07:00 on 1 February; August''s is too old');
select is((select report -> 'promotions' from february), '[]'::jsonb, 'the February read before the grants had no promotion cost');

select * from finish();
rollback;
