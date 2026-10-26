-- Invoices dated the night, with SAC, place of supply and signatory (#422, #423; decision 0194). The club's
-- rake on the nights of 31 March, 1 April and 30 November next year is invoiced the morning after, each dated
-- its night and numbered in its night's financial year; a night invoiced after its month's GSTR-1 is due is
-- dated when issued (the owner's answer to #471). Each tax invoice carries series S's SAC code,
-- Haryana as its place of supply (Karnataka for a buyer there, under IGST), and the authorised signatory.
-- Without the series' SAC code a tax invoice is refused; a practice invoice carries none of them. A night's
-- invoice covers its tournament fees with its rake, less any reversed, and a night with fees alone has one (#469).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.rake_on(p_day date, p_paise bigint) returns void language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.ledger_transaction (venue_id, kind, idempotency_key, occurred_at, memo)
  values ('00000000-0000-4000-8000-000000000001', 'hand_rake', 'night-test:' || p_day, (p_day + time '23:00') at time zone 'Asia/Kolkata', 'From a hand')
  returning id into v_id;
  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select '00000000-0000-4000-8000-000000000001', v_id, a.id, case when a.code = 'venue.rake' then -p_paise else p_paise end
  from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.member_id is null
    and a.code in ('venue.rake', 'venue.chips_outstanding');
end;
$$;

-- A tournament entry fee paid at the cage, as private.post_tournament_buy posts its fee part.
create function pg_temp.fee_at(p_key text, p_paise bigint, p_at timestamptz,
                                p_venue_id uuid default '00000000-0000-4000-8000-000000000001') returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.ledger_transaction (venue_id, kind, idempotency_key, occurred_at, memo)
  values (p_venue_id, 'tournament_buy', 'fee-test:' || p_key, p_at, 'A tournament entry fee')
  returning id into v_id;
  insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
  select p_venue_id, v_id, a.id, case when a.code = 'venue.tournament_fees' then -p_paise else p_paise end
  from public.ledger_account a where a.venue_id = p_venue_id and a.member_id is null
    and a.code in ('venue.tournament_fees', 'venue.cash_drawer');
  return v_id;
end;
$$;

-- Nights next year, invoiced on time whenever this runs: the turn of the financial year, a month's last night
-- and a night with fees and no rake; and a night two months back, invoiced late.
create temporary table nights as
select make_date(t.y, 3, 31) as march, make_date(t.y, 4, 1) as april, make_date(t.y, 11, 30) as november,
       make_date(t.y, 12, 5) as december, (date_trunc('month', current_date) - interval '2 months')::date + 4 as late, t.y
from (select extract(year from current_date)::integer + 1 as y) t;

select pg_temp.rake_on(n.march, 100000), pg_temp.rake_on(n.april, 100000), pg_temp.rake_on(n.november, 100000),
       pg_temp.rake_on(n.late, 100000),
       pg_temp.fee_at('november', 50000, (n.november + time '21:00') at time zone 'Asia/Kolkata'),
       pg_temp.fee_at('december', 118000, (n.december + time '21:00') at time zone 'Asia/Kolkata')
from nights n;
create temporary table march as select i.* from nights n, private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', n.march) i;
create temporary table april as select i.* from nights n, private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', n.april) i;
create temporary table november as select i.* from nights n, private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', n.november) i;
create temporary table late as select i.* from nights n, private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', n.late) i;

-- Dated the night.
select is((select (issued_at at time zone 'Asia/Kolkata')::date from march), (select march from nights),
  'the night of 31 March is dated 31 March, though issued the morning after');
select is((select financial_year from march), (select y - 1 from nights), 'and numbered in the old financial year''s series');
select ok((select m.number like '%/S' || to_char((n.y - 1) % 100, 'FM00') || '/%' from march m, nights n), 'its number says so');
select is((select financial_year from april), (select y from nights), 'the night of 1 April is the new year''s');
select ok((select a.number like '%/S' || to_char(n.y % 100, 'FM00') || '/%' from april a, nights n), 'and its number says so');
select is((select (issued_at at time zone 'Asia/Kolkata')::date from november), (select november from nights),
  'the night of a month''s last day is that month''s');
select is((select (issued_at at time zone 'Asia/Kolkata')::date from late), (now() at time zone 'Asia/Kolkata')::date,
  'a night invoiced after its month''s GSTR-1 is due, the 11th of the next month, is dated when issued');

-- Tournament fees, with the rake.
select is((select total_paise from november), 150000::bigint, 'a night''s invoice covers its tournament fees with its rake');
select is((select description from november),
  (select 'Club services: the rake and tournament fees of the business day of ' || to_char(november, 'FMDD Mon YYYY') from nights),
  'and says so');
select is((select description from march),
  (select 'Club services: the rake of the business day of ' || to_char(march, 'FMDD Mon YYYY') from nights), 'a night without fees reads as before');
select results_eq($$ select i.total_paise, i.taxable_paise, i.cgst_paise, i.sgst_paise, i.sac_code
                     from nights n, private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', n.december) i $$,
  $$ values (118000::bigint, 100000::bigint, 9000::bigint, 9000::bigint, '999692'::text) $$,
  'a night with fees and no rake has its invoice too, GST taken out of the fees');
create temporary table fees_before as
select private.day_tournament_fees('00000000-0000-4000-8000-000000000001', (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date) as fees;
select private.reverse_ledger_transaction(pg_temp.fee_at('refunded', 70000, now()), 'fee-test:refund', 'An entry refunded');
select pg_temp.fee_at('kept', 30000, now());
select is(private.day_tournament_fees('00000000-0000-4000-8000-000000000001', (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date),
  (select fees from fees_before) + 30000, 'less any fee reversed');
-- Fees refunded on a later night than they were taken count on that night: one whose refunds come to more
-- than its rake and fees has no invoice, and the daily job raises the alert.
create temporary table last_night as
select ((private.tonight_began(now()) - interval '1 day') at time zone 'Asia/Kolkata')::date as day;
select pg_temp.fee_at('refunds', -(private.day_rake('00000000-0000-4000-8000-000000000001', l.day)
                                   + private.day_tournament_fees('00000000-0000-4000-8000-000000000001', l.day) + 40000),
                      (l.day + time '22:00') at time zone 'Asia/Kolkata')
from last_night l;
select ok(private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000001', (select day from last_night)) is null,
  'a night whose refunds come to more than its rake and fees has no invoice');
select private.issue_rake_invoices();
select results_eq($$ select (detail ->> 'rake_paise')::bigint from public.alert
                     where venue_id = '00000000-0000-4000-8000-000000000001' and kind = 'invoice.rake_negative' $$,
  $$ values (-40000::bigint) $$, 'and the daily job raises the alert, with what the night came to');

-- SAC, place of supply, signatory.
select results_eq($$ select sac_code, place_of_supply, signatory_name, signatory_designation from march $$,
  $$ values ('999692'::text, 'Haryana'::text, 'Rhea Kapoor'::text, 'Partner'::text) $$,
  'a tax invoice carries its series'' SAC code, the venue''s state as its place of supply, and the signatory');
create temporary table karnataka as
select * from private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', 'sac-test:karnataka', 118000, 1800,
                                    'Club services: a private event', null, 'Southern Cards Private Limited', '29CCCCC2222C1Z7');
select results_eq($$ select place_of_supply, igst_paise > 0 from karnataka $$, $$ values ('Karnataka'::text, true) $$,
  'under IGST the place of supply is the buyer''s state');
select is((private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', 'sac-test:nil-rated', 50000, 0,
                                 'Club services: a private event', null, 'Southern Cards Private Limited', '29CCCCC2222C1Z7')).place_of_supply,
  'Karnataka', 'even when its IGST comes to nothing');
insert into public.invoice_series (venue_id, code, name) values ('00000000-0000-4000-8000-000000000001', 'A', 'Academy') on conflict do nothing;
select is((private.issue_invoice('00000000-0000-4000-8000-000000000001', 'A', 'sac-test:academy', 200000, 1800,
                                 'Poker Academy, Level 1', null, 'A student')).sac_code,
  '999293', 'an Academy invoice carries the Academy''s SAC code, not the club services''');
select throws_ok($$ select private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', 'sac-test:nowhere', 118000, 1800,
                                                 'Club services', null, 'Nowhere Private Limited', '99CCCCC2222C1Z7') $$,
  'RVGST', 'A tax invoice needs a place of supply: no state has the GSTIN state code 99', 'a buyer''s state code no state has is refused');

update public.venue_config set sac_club_services = null where venue_id = '00000000-0000-4000-8000-000000000001';
select throws_ok($$ select private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', 'sac-test:none', 118000, 1800, 'Club services') $$,
  'RVGST', 'A tax invoice needs its series'' SAC code in the venue''s configuration', 'without the series'' SAC code a tax invoice is refused');

create temporary table practice as
select * from private.issue_invoice('00000000-0000-4000-8000-000000000002', 'S', 'sac-test:practice', 118000, 1800, 'Club services',
                                    null, 'A practice buyer');
select results_eq($$ select is_tax_invoice, sac_code, place_of_supply, signatory_name from practice $$,
  $$ values (false, null::text, null::text, null::text) $$,
  'a practice invoice is no tax invoice and carries no SAC code, place of supply or signatory');
select pg_temp.fee_at('practice', 20000, (n.december + time '21:00') at time zone 'Asia/Kolkata', '00000000-0000-4000-8000-000000000002')
from nights n;
select results_eq($$ select i.is_tax_invoice, i.total_paise
                     from nights n, private.issue_day_rake_invoice('00000000-0000-4000-8000-000000000002', n.december) i $$,
  $$ values (false, 20000::bigint) $$, 'the practice venue''s tournament fees go on a practice invoice, never a tax invoice');

select * from finish();
rollback;
