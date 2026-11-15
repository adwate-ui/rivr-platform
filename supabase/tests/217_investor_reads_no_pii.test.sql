-- The investor reads no personal data (A1 of the Fix Tracker; the 28 Oct audit's invariants 1 and 2): Nikhil Bansal (109,
-- the owner's view: the ledger, reports and the audit log, but not members) reads no audit row naming anyone or holding
-- bank or contact details, no actor's address and no invoice. Vikram (101, a super admin) still reads them.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Ishaan (211) seated by the floor (103), and an invoice to him, so each read has a row to hide.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1,
  '9000000211'), null, 'the floor seats Ishaan');
reset role;
insert into public.invoice (venue_id, series_id, financial_year, sequence, number, source, is_tax_invoice, supplier_legal_name, supplier_address,
                            buyer_name, member_id, description, rate_basis_points, taxable_paise, cgst_paise, sgst_paise, total_paise)
select s.venue_id, s.id, 2026, 9999, 'RIVR/S26/9999', 'table_fee', false, 'RIVR', 'Gurugram', 'Ishaan Verma', '00000000-0000-4000-8000-000000000211',
       'Table fee', 0, 10000, 0, 0, 10000
from public.invoice_series s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.code = 'S';
select ok((select count(*) from public.audit_log where entity = 'member') > 0
          and (select count(*) from public.invoice) > 0, 'the log has rows about members, and there is an invoice');

select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is((select count(*)::integer from public.audit_log
           where coalesce(after, before) ?| array['phone', 'full_name', 'address', 'signature_svg', 'buyer_name', 'upi_vpa', 'bank_account_number', 'alert_whatsapp']),
  0, 'the investor reads no audit row naming anyone or holding bank or contact details');
select is((select count(*)::integer from public.audit_log where entity in ('member', 'staff', 'venue_config', 'kyc_record', 'contact')), 0,
  'nor any row about a member, staff, the venue''s configuration, a KYC check or a contact');
select ok((select count(*) from public.audit_log where entity in ('promotion', 'tier', 'game_table')) > 0, 'but still reads the club''s business in the log');
select throws_ok($$ select ip from public.audit_log $$, '42501', null, 'never the actor''s address');
select is((select count(*)::integer from public.invoice), 0, 'no invoice, which names its buyer');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select ok((select count(*) from public.audit_log where entity = 'member') > 0, 'a super admin still reads the rows about members');
select is((select count(*)::integer from public.invoice where number = 'RIVR/S26/9999'), 1, 'and the invoice');
reset role;

select * from finish();
rollback;
