-- GST invoices (#23, decision 0071, question #378): gst.config's rate and basis, effective-dated, with a
-- placeholder at every venue; invoices numbered per venue and series without gaps, with the venue's
-- prefix, from 1 each financial year; the practice venue's never tax invoices. 201 Arjun is a member of
-- the club, 301 Asha of the practice venue; 104 is a cashier (ledger.read), 108 a host.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated, anon;

-- An invoice in the club's series S for Arjun at 18%.
create function pg_temp.issue(p_source text, p_amount bigint) returns public.invoice language sql as $$
  select * from private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', p_source, p_amount, 1800, 'Club services',
                                      '00000000-0000-4000-8000-000000000201');
$$;
-- This financial year's two digits, as a number carries them.
create function pg_temp.yy() returns text language sql as $$
  select to_char(private.financial_year('00000000-0000-4000-8000-000000000001', now()) % 100, 'FM00');
$$;

-- The rate and basis.
select results_eq($$ select v.is_practice, private.setting_at(v.id, 'gst.config', '', now()) from public.venue v order by v.is_practice $$,
  $$ values (false, '{"rate_basis_points": 1800, "basis": "rake"}'::jsonb), (true, '{"rate_basis_points": 1800, "basis": "rake"}'::jsonb) $$,
  'every venue starts on 18% of the rake, a placeholder');
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'gst.config', '', '{"rate_basis_points": 4000, "basis": "table_fee"}', now() + interval '1 day', 'The ruling');
select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'gst.config', '', now()) ->> 'rate_basis_points', '1800',
  'a new rate waits for its date');
select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'gst.config', '', now() + interval '2 days'),
  '{"rate_basis_points": 4000, "basis": "table_fee"}'::jsonb, 'and is in force from it, with its basis');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'gst.config', '', '{"rate_basis_points": 1800, "basis": "chips"}', now() + interval '1 day', 'No') $$,
  '23514', null, 'the basis is the rake or a table fee');

-- Series and numbering.
select results_eq($$ select v.is_practice, s.code from public.invoice_series s join public.venue v on v.id = s.venue_id order by v.is_practice $$,
  $$ values (false, 'S'), (true, 'S') $$, 'every venue has series S for the club''s own supply');
select private.bootstrap_venue('00000000-0000-4000-8000-0000000007a1', 'RIVR Test', 'gst-test', false, 'Test Ltd', 'Somewhere', 'TST');
select is((select count(*)::integer from public.invoice_series where venue_id = '00000000-0000-4000-8000-0000000007a1' and code = 'S'), 1,
  'a new venue gets series S');
select is(private.setting_at('00000000-0000-4000-8000-0000000007a1', 'gst.config', '', now()) ->> 'basis', 'rake', 'and the placeholder');
select throws_ok($$ update public.venue_config set invoice_prefix = 'RIVRGGN' where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'a prefix of seven characters would not leave room for the number');

select is((select gstin from public.venue_config where venue_id = '00000000-0000-4000-8000-000000000001'), '06ABCDE1234F1Z4',
  'the seed gives the club a made-up GSTIN, so local and staging issue tax invoices');
update public.venue_config set gstin = null where venue_id = '00000000-0000-4000-8000-000000000001';
select throws_ok($$ select pg_temp.issue('booking:1', 200000) $$, 'RVGST', 'A tax invoice needs the venue''s GSTIN in its configuration',
  'no tax invoice without the venue''s GSTIN (owner, #378)');
update public.venue_config set gstin = '06AABCR1234Q1Z5' where venue_id = '00000000-0000-4000-8000-000000000001';

select pg_temp.issue('booking:1', 200000);
select results_eq($$ select number, buyer_name, is_tax_invoice, supplier_gstin, taxable_paise, cgst_paise, sgst_paise, total_paise
                     from public.invoice where source = 'booking:1' $$,
  $$ values ('RIVR/S' || pg_temp.yy() || '/1', 'Arjun Mehta'::text, true, '06AABCR1234Q1Z5'::text, 169492::bigint, 15254::bigint, 15254::bigint, 200000::bigint) $$,
  'the first invoice is number 1 in the venue''s prefix, series and year, to Arjun, with GST taken out of ₹2,000');
select is((pg_temp.issue('booking:1', 200000)).number, 'RIVR/S' || pg_temp.yy() || '/1', 'the same source again is the same invoice');
select throws_ok($$ select pg_temp.issue('booking:1', 400000) $$, '22023', 'That source has an invoice with other details',
  'but not with another amount');
-- No buyer: refused by the invoice itself, after the number was taken.
select throws_ok($$ select private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', 'booking:2', 150000, 1800, 'Academy seats') $$,
  '23502', null, 'an issue that fails');
select is((pg_temp.issue('booking:3', 100000)).number, 'RIVR/S' || pg_temp.yy() || '/2', 'leaves no gap: the next is number 2');
select private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', 'booking:4', 150000, 1800, 'Academy seats', null,
                             'Acme Pvt Ltd', '06AAACA1234B1Z2');
select results_eq($$ select number, member_id, buyer_name, buyer_gstin from public.invoice where source = 'booking:4' $$,
  $$ values ('RIVR/S' || pg_temp.yy() || '/3', null::uuid, 'Acme Pvt Ltd'::text, '06AAACA1234B1Z2'::text) $$,
  'a company buys under its own name and GSTIN, number 3');
select throws_ok($$ select private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', 'booking:11', 150000, 1800, 'Academy seats', null,
                                                 'Delhi Pvt Ltd', '07AAACD1234B1Z2') $$,
  'RVGST', 'A buyer registered in another state is charged IGST, which is not built yet', 'a company from another state waits for IGST');
insert into public.invoice_series (venue_id, code, name) values ('00000000-0000-4000-8000-000000000001', 'A', 'Academy');
select is((private.issue_invoice('00000000-0000-4000-8000-000000000001', 'A', 'booking:5', 200000, 1800, 'Academy seat',
                                 '00000000-0000-4000-8000-000000000201')).number,
  'RIVR/A' || pg_temp.yy() || '/1', 'another series counts on its own from 1');
insert into public.invoice_counter (series_id, venue_id, financial_year, last_number)
select s.id, s.venue_id, private.financial_year(s.venue_id, now()) - 1, 41 from public.invoice_series s
where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.code = 'S';
select is((pg_temp.issue('booking:6', 5000)).number, 'RIVR/S' || pg_temp.yy() || '/4', 'and each financial year on its own');
select is((select count(*)::integer from public.outbox_event e join public.invoice i on e.payload ->> 'invoice_id' = i.id::text
           where e.event_type = 'invoice.issued' and i.venue_id = '00000000-0000-4000-8000-000000000001'), 5,
  'each invoice is announced once');

update public.venue_config set legal_name = 'RIVR Gaming Pvt Ltd' where venue_id = '00000000-0000-4000-8000-000000000001';
select is((select supplier_legal_name from public.invoice where source = 'booking:1'), 'RIVR (legal name to be set)',
  'an invoice keeps the supplier as it was when issued');
select throws_ok($$ update public.invoice set total_paise = 0 where source = 'booking:1' $$, '42501', null, 'an invoice is never changed');
select throws_ok($$ delete from public.invoice where source = 'booking:1' $$, '42501', null, 'nor deleted');
select throws_ok($$ select pg_temp.issue('booking:7', -100) $$, '22023', null, 'an invoice is for nothing or more');
select throws_ok($$ select private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', 'booking:8', 100, 10001, 'No', null, 'Someone') $$,
  '22023', null, 'at a rate of at most 100%');
select throws_ok($$ select private.issue_invoice('00000000-0000-4000-8000-000000000001', 'Z', 'booking:9', 100, 1800, 'No', null, 'Someone') $$,
  '22023', 'No invoice series Z at this venue', 'in one of the venue''s series');

-- The practice venue: no GSTIN needed, and never a tax invoice, nor a GSTIN on one even if set there.
update public.venue_config set gstin = '06AABCP1234Q1Z5' where venue_id = '00000000-0000-4000-8000-000000000002';
select private.issue_invoice('00000000-0000-4000-8000-000000000002', 'S', 'practice:1', 200000, 1800, 'Academy seat',
                             '00000000-0000-4000-8000-000000000301');
select results_eq($$ select number, is_tax_invoice, supplier_gstin from public.invoice where source = 'practice:1' $$,
  $$ values ('PRAC/S' || pg_temp.yy() || '/1', false, null::text) $$,
  'the practice venue''s invoice is in its own numbering, not a tax invoice, and carries no GSTIN');
-- And one at the test venue, where none of the club's staff work.
update public.venue_config set gstin = '07AABCT1234Q1Z5' where venue_id = '00000000-0000-4000-8000-0000000007a1';
select is((private.issue_invoice('00000000-0000-4000-8000-0000000007a1', 'S', 'other:1', 100000, 1800, 'Club services', null, 'Someone')).number,
  'TST/S' || pg_temp.yy() || '/1', 'another venue numbers its own from 1');

-- The financial year turns on 1 April on the venue's clock.
select is(private.financial_year('00000000-0000-4000-8000-000000000001', '2027-03-31 23:59:59+05:30'), 2026, '31 March 2027 is in 2026''s year');
select is(private.financial_year('00000000-0000-4000-8000-000000000001', '2027-04-01 00:00:00+05:30'), 2027, '1 April 2027 begins 2027''s');

-- Who sees invoices.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select source from public.invoice order by source $$,
  $$ values ('booking:1'::text), ('booking:3'), ('booking:5'), ('booking:6') $$, 'Arjun sees his own invoices only');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.invoice where venue_id = '00000000-0000-4000-8000-000000000001'), 5,
  'a cashier sees the club''s invoices');
select is_empty($$ select * from public.invoice where venue_id = '00000000-0000-4000-8000-0000000007a1' $$, 'not another venue''s');
select is((select count(*)::integer from public.invoice_series where venue_id = '00000000-0000-4000-8000-000000000001'), 2, 'and the club''s series');
select is_empty($$ select * from public.invoice_series where venue_id = '00000000-0000-4000-8000-0000000007a1' $$, 'not another venue''s');
select throws_ok($$ select * from public.invoice_counter $$, '42501', null, 'nobody reads the counters');
select throws_ok($$ select private.issue_invoice('00000000-0000-4000-8000-000000000001', 'S', 'booking:10', 100, 1800, 'No',
                                                 '00000000-0000-4000-8000-000000000201') $$,
  '42501', null, 'nor issues an invoice directly');
select throws_ok($$ insert into public.invoice_series (venue_id, code, name) values ('00000000-0000-4000-8000-000000000001', 'B', 'No') $$,
  '42501', null, 'nor adds a series');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is_empty($$ select * from public.invoice $$, 'a host sees no invoices');
select is_empty($$ select * from public.invoice_series $$, 'nor series');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select results_eq($$ select source from public.invoice $$, $$ values ('practice:1'::text) $$, 'Asha sees her practice invoice');
reset role;
set local role anon;
select throws_ok($$ select * from public.invoice $$, '42501', null, 'a signed-out caller is refused');
reset role;

select * from finish();
rollback;
