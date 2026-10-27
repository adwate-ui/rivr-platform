-- Payout accounts (#19). 211 Ishaan adds a UPI address and a bank account; 104, a cashier, verifies one
-- and turns the other down. 201 Arjun's is the seed's, verified. 106 Pema is a dealer; 212 Vihaan
-- another member; 301 Asha the practice venue's member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- A member adds them; each waits for the cage.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'upi', public.add_payout_account('upi', 'HDFC Bank', ' Ishaan.Verma@HDFCBANK ');
insert into ids select 'bank', public.add_payout_account('bank', 'ICICI Bank', null, '001234567890', 'icic0000123', 'Ishaan Verma');
select results_eq($$ select kind, bank_name, vpa, account_number, ifsc, holder_name, status from public.payout_account order by kind desc $$,
  $$ values ('upi'::text, 'HDFC Bank'::text, 'ishaan.verma@hdfcbank'::text, null::text, null::text, null::text, 'pending'::text),
            ('bank', 'ICICI Bank', null, '001234567890', 'ICIC0000123', 'Ishaan Verma', 'pending') $$,
  'Ishaan''s UPI address and bank account wait for the cage, written as banks write them');
select throws_ok($$ select public.add_payout_account('upi', 'HDFC Bank', 'ishaan.verma@hdfcbank') $$, '23505', null, 'the same address once');
select throws_ok($$ select public.add_payout_account('upi', 'HDFC Bank', 'not an address') $$, '22023', null, 'a UPI address that is one');
select throws_ok($$ select public.add_payout_account('bank', 'ICICI Bank', null, '0012', 'ICIC0000123', 'Ishaan Verma') $$, '22023', null,
  'an account number of 9 to 18 digits');
select throws_ok($$ select public.add_payout_account('bank', 'ICICI Bank', null, '001234567899', 'ICIC0000123') $$, '22023', null, 'with the holder''s name');
select throws_ok($$ select public.add_payout_account('upi', ' ', 'ishaan@ybl') $$, '22023', null, 'and the bank''s name');
insert into ids select 'third', public.add_payout_account('upi', 'Axis Bank', 'ishaan@axl');
select throws_ok($$ select public.add_payout_account('upi', 'Kotak', 'ishaan@kotak') $$, 'RVMAX', null, 'three at most');
select lives_ok($$ select public.remove_payout_account((select id from ids where name = 'third')) $$, 'he removes one');
select isnt((select removed_at from public.payout_account where id = (select id from ids where name = 'third')), null, 'kept for the record, removed');
select throws_ok($$ select public.decide_payout_account((select id from ids where name = 'upi'), true) $$, '42501', null, 'and verifies none himself');

-- Who sees them: the member his own, the venue's cage; not another member, a dealer or another venue.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select is_empty($$ select id from public.payout_account where member_id = '00000000-0000-4000-8000-000000000211' $$, 'another member sees none of his');
select throws_ok($$ select public.remove_payout_account((select id from ids where name = 'upi')) $$, '22023', null, 'nor removes one');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select id from public.payout_account $$, 'a dealer sees none');
select is_empty($$ select * from public.payout_accounts_to_verify('00000000-0000-4000-8000-000000000001') $$, 'nor the cage''s list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select is_empty($$ select id from public.payout_account $$, 'the practice venue''s member sees none of the club''s');
select is((select count(*)::integer from public.my_payout_accounts()), 0, 'nor has any of hers');
reset role;
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select id from public.payout_account where venue_id = '00000000-0000-4000-8000-000000000001' $$, 'the practice venue''s cashier sees none of the club''s');
select is_empty($$ select * from public.payout_accounts_to_verify('00000000-0000-4000-8000-000000000001') $$, 'nor its list');
select throws_ok($$ select public.decide_payout_account((select id from ids where name = 'upi'), true) $$, '42501', null, 'and verifies none of them');
reset role;
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';

-- Never one's own: a cashier who is also the member verifies none of theirs.
update public.member set phone = '+919000000104' where id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.decide_payout_account((select id from ids where name = 'upi'), true) $$, '42501', null,
  'a cashier who is also the member verifies none of their own');
reset role;
update public.member set phone = '+919000000211' where id = '00000000-0000-4000-8000-000000000211';
-- The cage verifies one and turns the other down, with a reason; each is audited.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select set_eq($$ select full_name, kind, bank_name from public.payout_accounts_to_verify('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Ishaan Verma'::text, 'upi'::text, 'HDFC Bank'::text), ('Ishaan Verma', 'bank', 'ICICI Bank') $$, 'the cashier lists the two waiting');
select lives_ok($$ select public.decide_payout_account((select id from ids where name = 'upi'), true) $$, 'verifies the UPI address');
select throws_ok($$ select public.decide_payout_account((select id from ids where name = 'bank'), false, '') $$, '22023', null, 'turns one down only with a reason');
select lives_ok($$ select public.decide_payout_account((select id from ids where name = 'bank'), false, 'Name differs from KYC') $$, 'turns the bank account down');
select throws_ok($$ select public.decide_payout_account((select id from ids where name = 'upi'), false, 'Again') $$, '22023', null, 'decides each once');
select throws_ok($$ select public.decide_payout_account((select id from ids where name = 'bank'), true) $$, '22023', null, 'never verifies one turned down');
select throws_ok($$ select public.decide_payout_account((select id from ids where name = 'third'), true) $$, '22023', null, 'nor one removed');
select is_empty($$ select * from public.payout_accounts_to_verify('00000000-0000-4000-8000-000000000001') $$, 'and none waits');
reset role;
select results_eq($$ select a.status, a.reject_reason, s.user_id from public.payout_account a join public.staff s on s.id = a.decided_by_staff_id
                     where a.member_id = '00000000-0000-4000-8000-000000000211' and a.removed_at is null order by a.kind desc $$,
  $$ values ('verified'::text, null::text, '00000000-0000-4000-8000-000000000104'::uuid), ('rejected', 'Name differs from KYC', '00000000-0000-4000-8000-000000000104') $$,
  'each decision names the cashier, and the reason for the one turned down');
select is((select count(*)::integer from public.audit_log where entity = 'payout_account' and entity_id = (select id from ids where name = 'upi')::text), 2,
  'the audit holds its adding and its verifying');
select is_empty($$ select 1 from public.audit_log where entity = 'payout_account'
                   and (before ?| array['vpa', 'account_number', 'ifsc', 'holder_name'] or after ?| array['vpa', 'account_number', 'ifsc', 'holder_name']) $$,
  'and never an address, number, IFSC or holder''s name');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select reject_reason from public.payout_account where id = (select id from ids where name = 'bank')), 'Name differs from KYC', 'Ishaan sees why');
select set_eq($$ select kind, status from public.my_payout_accounts() $$, $$ values ('upi'::text, 'verified'::text), ('bank', 'rejected') $$,
  'his accounts in use: the one removed is gone');

-- The seed: Arjun's HDFC Bank UPI, verified.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select bank_name, kind, status from public.payout_account $$, $$ values ('HDFC Bank'::text, 'upi'::text, 'verified'::text) $$,
  'Arjun''s HDFC Bank UPI is verified');

-- Frozen: no change while the member or venue is frozen.
reset role;
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000211', 'Dispute');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.add_payout_account('upi', 'Kotak', 'ishaan@kotak') $$, 'RVMBR', null, 'a frozen member adds none');
select throws_ok($$ select public.remove_payout_account((select id from ids where name = 'upi')) $$, 'RVMBR', null, 'and removes none');
reset role;

select * from finish();
rollback;
