-- Academy fees on GST invoices (#249, decision 0114): when the cage confirms a payment, the booking gets an
-- invoice in the Academy's series at the Academy's rate, to the member or to the company under its GSTIN (IGST
-- for another state's), and the ledger splits the fee as the invoice does. The member reads it; nobody else
-- does. A practice booking gets a practice invoice. 103 Aditya (admin, members.manage), 104 Sana (cashier),
-- 201 Arjun and 202 Kabir (members), 301 Asha (practice venue); the seed taxes at 18%.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;
grant execute on function pg_temp.as_user(uuid), pg_temp.id(text) to authenticated;
-- What a booking's payment posted to an account, by code.
create function pg_temp.posted(p_booking text, p_code text) returns bigint language sql as $$
  select coalesce(sum(e.amount), 0)::bigint from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
  join public.academy_booking k on k.ledger_transaction_id = e.transaction_id
  where k.id = pg_temp.id(p_booking) and a.code = p_code;
$$;

select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
insert into ids values
  ('batch', public.create_academy_batch('00000000-0000-4000-8000-000000000001', 'Level 1, November', current_date + 10, current_date + 12, 20)),
  ('practice-batch', public.create_academy_batch('00000000-0000-4000-8000-000000000002', 'Practice batch', current_date + 10, current_date + 12, 5));
insert into ids values
  ('haryana', public.book_academy_corporate(pg_temp.id('batch'), '00000000-0000-4000-8000-000000000202', 'Northern Gaming Pvt Ltd', 3, gen_random_uuid(), '06BBBBB1111B1Z6')),
  ('karnataka', public.book_academy_corporate(pg_temp.id('batch'), '00000000-0000-4000-8000-000000000202', 'Southern Cards Pvt Ltd', 2, gen_random_uuid(), '29CCCCC2222C1Z7'));
select throws_ok($$ select public.book_academy_corporate(pg_temp.id('batch'), '00000000-0000-4000-8000-000000000202', 'Bad', 1, gen_random_uuid(), 'not a gstin') $$,
  '23514', null, 'a company''s GSTIN is a GSTIN');
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
insert into ids values ('arjun', public.book_academy(pg_temp.id('batch')));
select public.claim_academy_payment(pg_temp.id('arjun'), '412345678901');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select public.record_academy_payment(pg_temp.id('haryana'), '412345678902');
select public.record_academy_payment(pg_temp.id('karnataka'), '412345678903');
reset role;
insert into ids select 'asha', public.book_academy(pg_temp.id('practice-batch'))
from (select pg_temp.as_user('00000000-0000-4000-8000-000000000301')) signed_in;
select pg_temp.as_user('00000000-0000-4000-8000-000000000301');
select public.claim_academy_payment(pg_temp.id('asha'), '412345678904');

-- The rake's GST rises to 40%; the Academy's stays at 18% (academy.gst, question #431).
reset role;
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'gst.config', '', '{"rate_basis_points": 4000, "basis": "rake"}', now(), 'The rake taxed at 40%');

-- The cashier confirms all four.
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select public.confirm_academy_payment(pg_temp.id(name), utr)
from (values ('arjun', '412345678901'), ('haryana', '412345678902'), ('karnataka', '412345678903'), ('asha', '412345678904')) as p (name, utr);
reset role;

select results_eq(
  $$ select i.is_tax_invoice, i.number ~ '^[A-Z0-9-]+/A[0-9]{2}/[0-9]+$', i.buyer_name, i.taxable_paise, i.cgst_paise, i.sgst_paise, i.igst_paise, i.total_paise
     from public.academy_booking k join public.invoice i on i.id = k.invoice_id where k.id = pg_temp.id('arjun') $$,
  $$ values (true, true, 'Arjun Mehta'::text, 169492::bigint, 15254::bigint, 15254::bigint, 0::bigint, 200000::bigint) $$,
  'Arjun''s ₹2,000 has a tax invoice in the Academy''s series, to him, with CGST and SGST taken out of it');
select is(array[pg_temp.posted('arjun', 'venue.bank'), pg_temp.posted('arjun', 'venue.academy'), pg_temp.posted('arjun', 'venue.gst_payable')],
  array[200000::bigint, -169492, -30508], 'the ledger takes ₹2,000 into the bank: ₹1,694.92 of Academy fees and ₹305.08 of GST owed');
select results_eq(
  $$ select i.buyer_name, i.buyer_gstin, i.cgst_paise, i.igst_paise, i.total_paise
     from public.academy_booking k join public.invoice i on i.id = k.invoice_id where k.id in (pg_temp.id('haryana'), pg_temp.id('karnataka'))
     order by i.total_paise desc $$,
  $$ values ('Northern Gaming Pvt Ltd'::text, '06BBBBB1111B1Z6'::text, 34322::bigint, 0::bigint, 450000::bigint),
            ('Southern Cards Pvt Ltd', '29CCCCC2222C1Z7', 0, 45763, 300000) $$,
  'a company is invoiced under its GSTIN: CGST and SGST from Haryana, IGST from another state');
select is(pg_temp.posted('karnataka', 'venue.gst_payable'), -45763::bigint, 'and its IGST is owed in full');
select results_eq(
  $$ select i.is_tax_invoice, i.supplier_gstin from public.academy_booking k join public.invoice i on i.id = k.invoice_id where k.id = pg_temp.id('asha') $$,
  $$ values (false, null::text) $$, 'a practice booking gets a practice invoice, never a tax invoice');
select is_empty($$ select * from public.claim_outbox_deliveries('accounts', array['invoice.issued'], false)
                   where venue_id = '00000000-0000-4000-8000-000000000002' $$,
  'and its invoice.issued never leaves');

-- The member reads their invoice; nobody else reads it.
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
select results_eq($$ select buyer_name, total_paise from public.my_academy_invoice(pg_temp.id('arjun')) $$,
  $$ values ('Arjun Mehta'::text, 200000::bigint) $$, 'Arjun reads his invoice');
select pg_temp.as_user('00000000-0000-4000-8000-000000000202');
select is_empty($$ select * from public.my_academy_invoice(pg_temp.id('arjun')) $$, 'another member does not');
select results_eq($$ select buyer_name from public.my_academy_invoice(pg_temp.id('haryana')) $$,
  $$ values ('Northern Gaming Pvt Ltd'::text) $$, 'and a company''s contact reads its invoice');
select results_eq($$ select status from public.my_academy_bookings() where id = pg_temp.id('haryana') $$,
  $$ values ('paid'::text) $$, 'from the company''s booking, which shows to its contact once paid');
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.my_academy_invoice(pg_temp.id('arjun')) $$, 'the cashier who confirmed it does not');
reset role;
select ok(not has_function_privilege('anon', 'public.my_academy_invoice(uuid)', 'execute'), 'nor does anyone signed out');

-- Confirming again changes nothing: one invoice, one posting.
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select public.confirm_academy_payment(pg_temp.id('arjun'), '412345678901');
reset role;
select is((select count(*)::integer from public.invoice where source = 'academy:' || pg_temp.id('arjun')), 1, 'confirming again issues no second invoice');


-- Without the venue's GSTIN no tax invoice is issued, and the cashier is told why.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
insert into ids values ('batch-2', public.create_academy_batch('00000000-0000-4000-8000-000000000001', 'Level 2, November', current_date + 20, current_date + 22, 20));
select pg_temp.as_user('00000000-0000-4000-8000-000000000201');
insert into ids values ('arjun-2', public.book_academy(pg_temp.id('batch-2')));
select public.claim_academy_payment(pg_temp.id('arjun-2'), '412345678905');
reset role;
update public.venue_config set gstin = null where venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.confirm_academy_payment(pg_temp.id('arjun-2'), '412345678905') $$, 'RVGST', null,
  'without the venue''s GSTIN the cashier cannot confirm, and is told why');
reset role;

select * from finish();
rollback;
