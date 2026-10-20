-- The daily rake invoice (#379, decision 0106): one invoice in series S per business day for that day's
-- rake, to unregistered customers as one consolidated buyer, GST taken out at the rate in force when the
-- day began; once per day; none for a day without rake; the practice venue's never a tax invoice; and the
-- daily job, which invoices every ended day it finds without one and alerts for a venue refused.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Today's business day, as the club counts it from 06:00 IST.
create function pg_temp.today() returns date language sql as $$
  select (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date;
$$;
-- A moment on the club's clock: a day at a time of day, in IST.
create function pg_temp.ist(p_day date, p_time time) returns timestamptz language sql as $$
  select (p_day + p_time) at time zone 'Asia/Kolkata';
$$;
-- A hand's rake or jackpot drop posted at a moment, as log_hand posts them (chips in play debited; the rake,
-- or the jackpot, credited); only the database's owner can set when.
create function pg_temp.post_at(p_venue_id uuid, p_kind text, p_key text, p_paise bigint, p_at timestamptz) returns void language plpgsql as $$
declare
  v_id uuid;
  v_credit text := case when p_kind = 'hand_rake' then 'venue.rake' else 'venue.jackpot.main' end;
begin
  insert into public.ledger_transaction (venue_id, kind, idempotency_key, occurred_at, memo)
  values (p_venue_id, p_kind, p_key, p_at, 'From a hand') returning id into v_id;
  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select p_venue_id, v_id, a.id, case when a.code = v_credit then -p_paise else p_paise end
  from public.ledger_account a where a.venue_id = p_venue_id and a.code in (v_credit, 'venue.chips_outstanding');
end;
$$;
create function pg_temp.rake_at(p_venue_id uuid, p_key text, p_paise bigint, p_at timestamptz) returns void language sql as $$
  select pg_temp.post_at(p_venue_id, 'hand_rake', p_key, p_paise, p_at);
$$;

-- Two hands logged tonight: their rake counts, their jackpot drop (players' money) does not.
create temp table before as select private.day_rake('00000000-0000-4000-8000-000000000001', pg_temp.today()) as rake;
select pg_temp.rake_at('00000000-0000-4000-8000-000000000001', 'hand:1:rake', 50000, now());
select pg_temp.post_at('00000000-0000-4000-8000-000000000001', 'jackpot_drop', 'hand:1:drop', 10000, now());
select pg_temp.rake_at('00000000-0000-4000-8000-000000000001', 'hand:2:rake', 25000, now());
select pg_temp.post_at('00000000-0000-4000-8000-000000000001', 'jackpot_drop', 'hand:2:drop', 5000, now());
select is(private.day_rake('00000000-0000-4000-8000-000000000001', pg_temp.today()), (select rake from before) + 75000,
  'the day''s rake is what venue.rake was credited by its hands, without their jackpot drop');

create temp table first as select * from private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', pg_temp.today());
select results_eq(
  $$ select source, buyer_name, member_id, buyer_gstin, is_tax_invoice, rate_basis_points, total_paise from first $$,
  $$ select 'rake:' || pg_temp.today()::text, 'Unregistered customers, consolidated'::text, null::uuid, null::text, true, 1800,
            (select rake from before) + 75000 $$,
  'one tax invoice in series S for the day''s rake, to unregistered customers as one buyer, at 18%');
select results_eq($$ select f.taxable_paise, f.cgst_paise, f.sgst_paise from first f $$,
  $$ select g.taxable_paise, g.cgst_paise, g.sgst_paise from private.gst_included((select rake from before) + 75000, 1800) g $$,
  'with CGST and SGST taken out of it');
select ok((select number ~ '^RIVR/S[0-9]{2}/[0-9]+$' from first), 'numbered in series S');
select is((private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', pg_temp.today())).id, (select id from first),
  'a second run gives the same invoice');
select is((select count(*)::integer from public.invoice where source = 'rake:' || pg_temp.today()::text and venue_id = '00000000-0000-4000-8000-000000000001'), 1,
  'and issues nothing new');
select is(private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', '2026-01-01'), null, 'a day without rake has no invoice');
select is_empty($$ select * from public.invoice where source = 'rake:2026-01-01' $$, 'and none is issued');

-- The day turns at 06:00 IST.
select pg_temp.rake_at('00000000-0000-4000-8000-000000000001', 'test:boundary:1', 20000, pg_temp.ist(pg_temp.today(), '05:59:59'));
select pg_temp.rake_at('00000000-0000-4000-8000-000000000001', 'test:boundary:2', 30000, pg_temp.ist(pg_temp.today() - 3, '23:00'));
select is(private.day_rake('00000000-0000-4000-8000-000000000001', pg_temp.today() - 1), 20000::bigint, '05:59:59 IST is the night before');
select is(private.day_rake('00000000-0000-4000-8000-000000000001', pg_temp.today() - 3), 30000::bigint, 'and 23:00 the night it began');

-- The practice venue: none while GST is charged on a table fee from the day's start; then a practice
-- invoice, never a tax invoice.
select pg_temp.rake_at('00000000-0000-4000-8000-000000000002', 'hand:3:rake', 10000, now());
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000002', 'gst.config', '', '{"rate_basis_points": 1800, "basis": "table_fee"}',
        pg_temp.ist(pg_temp.today(), '06:00'), 'Test');
select is(private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000002', pg_temp.today()), null,
  'no rake invoice while GST is charged on a table fee');
delete from public.setting where venue_id = '00000000-0000-4000-8000-000000000002' and key = 'gst.config' and reason = 'Test';
select results_eq($$ select is_tax_invoice, supplier_gstin from private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000002', pg_temp.today()) $$,
  $$ values (false, null::text) $$, 'the practice venue''s rake invoice is a practice invoice');

-- The daily job. The club has no GSTIN yet: it is refused, with an alert, and the practice venue's goes through.
select pg_temp.rake_at('00000000-0000-4000-8000-000000000002', 'test:practice:1', 10000, pg_temp.ist(pg_temp.today() - 1, '22:00'));
update public.venue_config set gstin = null where venue_id = '00000000-0000-4000-8000-000000000001';
select private.issue_rake_invoices();
select is((select count(*)::integer from public.alert where venue_id = '00000000-0000-4000-8000-000000000001' and kind = 'invoice.rake_refused'), 1,
  'a venue refused raises one alert');
select is_empty($$ select * from public.invoice where venue_id = '00000000-0000-4000-8000-000000000001' and source like 'rake:%'
                    and source <> 'rake:' || pg_temp.today()::text $$, 'and has no invoice for the nights that ended');
select is((select total_paise from public.invoice where venue_id = '00000000-0000-4000-8000-000000000002' and source = 'rake:' || (pg_temp.today() - 1)::text),
  10000::bigint, 'while the practice venue has its invoice for last night');

-- Once the GSTIN is in, the next run invoices every night left without one, and none twice.
update public.venue_config set gstin = '06ABCDE1234F1Z4' where venue_id = '00000000-0000-4000-8000-000000000001';
select private.issue_rake_invoices();
select results_eq($$ select source, total_paise from public.invoice where venue_id = '00000000-0000-4000-8000-000000000001' and source like 'rake:%'
                     and source <> 'rake:' || pg_temp.today()::text order by source $$,
  $$ values ('rake:' || (pg_temp.today() - 3)::text, 30000::bigint), ('rake:' || (pg_temp.today() - 1)::text, 20000::bigint) $$,
  'the next run invoices the nights refused, and not tonight, which has not ended');
select is((select count(*)::integer from public.invoice where venue_id = '00000000-0000-4000-8000-000000000002' and source like 'rake:%'), 2,
  'and issues the practice venue nothing new');
select is((select count(*)::integer from cron.job where jobname = 'daily-rake-invoice' and schedule = '30 1 * * *'), 1,
  'the job runs every day at 07:00 IST');

set local role authenticated;
select throws_ok($$ select private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', pg_temp.today()) $$,
  '42501', null, 'no one signed in issues a rake invoice');

select * from finish();
rollback;
