-- What the removals left in the database (issue 1012; decision 0650): the owner dashboard's signals are gone; a purge in
-- hand is one set in the database owner's own session; and a refused duplicate done in person, reopened, keeps no photo
-- and nothing typed for it.
-- 101 Vikram is a super admin; 203 Naina was refused by hand; 204 Rohan is verified by hand.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------------------
-- The owner dashboard's signals.
select is_empty($$ select tgname from pg_trigger where tgname like '%owner_signal%' $$,
  'no table signals an owner dashboard: not the ledger on every insert, nor hands, alerts, tables, seats or visits');
select hasnt_function('private', 'signal_owner_dashboard', 'the signal''s function is gone with them');
select is_empty($$ select policyname from pg_policies where schemaname = 'realtime' and tablename = 'messages' and qual like '%owner:%' $$,
  'and nobody is let hear an owner topic that nothing sends on');
select lives_ok($$ select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'bonus', 'test-490-posting',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.bonus_expense'), 'amount', 5000),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001' and a.code = 'member.bonus'
                                        and a.member_id = '00000000-0000-4000-8000-000000000201'), 'amount', -5000)), 'promotions') $$,
  'a ledger posting still goes through without the signal');

-- ---------------------------------------------------------------------------------------------------
-- A purge in hand.
select ok(private.purging('00000000-0000-4000-8000-000000000001') is not true, 'no purge is in hand while the setting is off');
select set_config('rivr.purge', 'on', true), set_config('rivr.purge_venue', '00000000-0000-4000-8000-000000000001', true);
select is(private.purging('00000000-0000-4000-8000-000000000001'), true, 'the database''s owner, in a session of their own, has one in hand for the venue they named');
select ok(private.purging('00000000-0000-4000-8000-000000000002') is not true, 'and for no other venue');
select set_config('role', 'authenticated', true);
select ok(private.purging('00000000-0000-4000-8000-000000000001') is not true, 'an API role has none, whatever the setting says');
reset role;
select ok((select prosrc ~ 'current_user = ''postgres'' and session_user = ''postgres''' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname = 'purging'),
  'it asks the session''s own role as well as the current one, as the ledger''s guard does: inside a security definer function the current role is always the owner');
select ok((select prosrc ~ 'session_user = ''postgres''' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'private' and p.proname = 'ledger_append_only'), 'the ledger''s guard asks the same');
select set_config('rivr.purge', '', true), set_config('rivr.purge_venue', '', true);

-- ---------------------------------------------------------------------------------------------------
-- Reopening a check done in person.
insert into public.kyc_record (venue_id, member_id, status, method, refusal, date_of_birth, masked_aadhaar, pan, photo_path) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 'refused', 'manual', 'duplicate_aadhaar',
   '1990-04-12', 'XXXX XXXX 1234', 'ABCPN1234D',
   '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/in-person-00000000-0000-4000-8000-0000000000a1.jpg')
on conflict (member_id) do update set status = excluded.status, method = excluded.method, refusal = excluded.refusal, verified_at = null,
  date_of_birth = excluded.date_of_birth, masked_aadhaar = excluded.masked_aadhaar, pan = excluded.pan, photo_path = excluded.photo_path;

select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}', true);
select lives_ok($$ select public.reopen_kyc_check('00000000-0000-4000-8000-000000000203', 'The date of birth was typed wrong at the desk') $$,
  'a super admin reopens a refused duplicate done in person');
reset role;
select results_eq($$ select status::text, refusal is null, photo_path is null from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values ('started', true, true) $$, 'it starts again with no refusal and no photo of the refused check');
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}', true);
select results_eq($$ select date_of_birth is null, masked_aadhaar is null, pan is null from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000203' $$,
  $$ values (true, true, true) $$, 'and the member reads no date of birth, Aadhaar digits or PAN typed for it, which were another person''s');
reset role;

select * from finish();
rollback;
