-- Purge a live venue (#432; decision 0239). A throwaway venue, "Test Room", with Kunal (134) as its super admin and one
-- member, with a login, a deposit and a freeze. Kunal cannot purge it before it is frozen, nor without an archive made
-- after the freeze, read to its end and saved, nor once the venue has changed since, nor with the wrong name; then he
-- purges it: the member, the deposit, its ledger entries, the freeze and the member's login go, and the audit log keeps
-- no member's name; the venue's own accounts, its setup and the audit log stay, the owner is alerted, and the club is
-- untouched. The practice venue resets instead; a cashier purges nothing.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- What a purge deletes from is a decision for each venue table: a new one fails here until it is listed or kept.
select set_eq($$ select private.live_purge_tables() $$,
  $$ select unnest(array['academy_batch', 'academy_booking', 'academy_utr_rejection', 'account_transfer', 'alert', 'bonus_grant', 'buy_in_request',
     'cage_shift', 'cage_transaction', 'chip_inventory_count', 'chip_inventory_line', 'consent', 'credit_line', 'dealer_down', 'deposit_request',
     'down_count', 'early_departure', 'eod_close', 'expense', 'feedback', 'hand', 'high_hand_claim', 'incident', 'invoice', 'invoice_counter',
     'jackpot_event', 'kyc_record', 'kyc_review', 'league_finish', 'ledger_account', 'ledger_entry', 'ledger_transaction', 'marker',
     'marker_settlement', 'member', 'member_feature_override', 'member_limit', 'member_preference', 'member_tier_change', 'membership_card',
     'mis_report', 'notification_preference', 'outbox_delivery', 'outbox_event', 'payout_account', 'points_earning', 'promotion',
     'promotion_budget', 'promotion_grant', 'promotion_rule', 'redemption', 'sar_entry', 'sar_entry_transaction', 'seat_move', 'seat_session',
     'second_approval', 'self_exclusion', 'sign_up_attribution', 'staff_attendance', 'staff_shift', 'tds_withholding', 'tournament',
     'tournament_entry', 'tournament_payout', 'tournament_purchase', 'visit', 'waitlist_entry', 'withdrawal_request']) $$,
  'a purge deletes these tables'' rows, and keeps every other venue table');

-- The throwaway venue, its super admin and a member with a deposit.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f3', 'Test Room', 'test-room', false, 'Test Room LLP', 'Gurugram', 'TST');
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select '00000000-0000-4000-8000-0000000000f3', s.user_id, s.full_name, s.job_title, 'super_admin', s.phone
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000134' and s.venue_id = '00000000-0000-4000-8000-000000000001';
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e150', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000000994');
insert into public.member (id, venue_id, user_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-00000000e150', 'Test Member', '+919000000994');
select private.post_ledger_transaction('00000000-0000-4000-8000-0000000000f3', 'deposit', 'purge-test-deposit',
  jsonb_build_array(jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-0000000000f3'
                                                      and code = 'venue.bank' and member_id is null), 'amount', '500000'),
                    jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-0000000000f4'
                                                      and code = 'member.cash'), 'amount', '-500000')), null);
create temp table club_before as
  select (select count(*) from public.member where venue_id = '00000000-0000-4000-8000-000000000001') as members,
         (select count(*) from public.ledger_entry where venue_id = '00000000-0000-4000-8000-000000000001') as entries;
grant select on club_before to authenticated;

-- Who, and when.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.live_purge_preview('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a cashier purges nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select * from public.live_purge_preview('00000000-0000-4000-8000-000000000002') $$, 'RVPRC', null,
  'the practice venue resets to its seed instead');
select throws_ok($$ select * from public.live_purge_preview('00000000-0000-4000-8000-0000000000f3') $$, 'RVNFZ', null,
  'a venue is frozen before it is purged');
reset role;
-- Frozen ten minutes ago (a test's clock stands still), and the member frozen too.
insert into public.control_state (venue_id, level, reason, engaged_at)
values ('00000000-0000-4000-8000-0000000000f3', 'venue_freeze', 'Purging the test room', now() - interval '10 minutes');
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-0000000000f3', 'member_freeze', '00000000-0000-4000-8000-0000000000f4', 'Test freeze');
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select results_eq($$ select current_rows from public.live_purge_preview('00000000-0000-4000-8000-0000000000f3') where table_name in ('member', 'ledger_entry') order by table_name $$,
  $$ values (2::bigint), (1::bigint) $$, 'the dry run counts the member and the deposit''s two entries');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-0000000000f3', 'Test Room') $$, 'RVARC', null,
  'not without a saved archive');

-- An archive made before the freeze does not count.
reset role;
insert into private.export_archive (venue_id, started_by, started_at, completed_at, counts)
values ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-000000000134', now() - interval '20 minutes', now(),
        (select jsonb_object_agg(t, private.venue_row_count('00000000-0000-4000-8000-0000000000f3', t)) from private.live_purge_tables() t));
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-0000000000f3', 'Test Room') $$, 'RVARC', null, 'an archive made before the freeze does not count');

-- The archive, made after the freeze, read and saved.
reset role;
insert into private.export_archive (id, venue_id, started_by, counts)
values ('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-000000000134',
        (select jsonb_object_agg(t, private.venue_row_count('00000000-0000-4000-8000-0000000000f3', t)) from private.live_purge_tables() t));
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.complete_export_archive('00000000-0000-4000-8000-0000000000f5', 'abababababababababababababababababababababababababababababababab', 1024) $$, '22023', null, 'only its maker marks it saved');
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select public.complete_export_archive('00000000-0000-4000-8000-0000000000f5', 'abababababababababababababababababababababababababababababababab', 1024) $$, '22023', null, 'and only once every table is read to its end');
reset role;
update private.export_archive set tables_read = array(select jsonb_object_keys(counts)) where id = '00000000-0000-4000-8000-0000000000f5';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select public.complete_export_archive('00000000-0000-4000-8000-0000000000f5', 'not a hash', 1024) $$, '22023', null, 'with the file''s SHA-256 and size');
select lives_ok($$ select public.complete_export_archive('00000000-0000-4000-8000-0000000000f5', 'abababababababababababababababababababababababababababababababab', 1024) $$, 'its maker marks it saved');
reset role;
update private.export_archive set counts = counts || '{"member": 99}' where id = '00000000-0000-4000-8000-0000000000f5';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-0000000000f3', 'Test Room') $$, 'RVARC', null, 'not once the venue has changed since the archive');
reset role;
update private.export_archive set counts = counts || jsonb_build_object('member', private.venue_row_count('00000000-0000-4000-8000-0000000000f3', 'member')) where id = '00000000-0000-4000-8000-0000000000f5';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-0000000000f3', 'Test room') $$, 'RVNAM', null,
  'the name is typed exactly');
create temp table purged as select * from public.purge_live_venue('00000000-0000-4000-8000-0000000000f3', 'Test Room');
select results_eq($$ select deleted_rows from purged where table_name in ('ledger_entry', 'member') order by table_name $$,
  $$ values (2::bigint), (1::bigint) $$, 'it deletes the deposit''s entries and the member');

reset role;
select is((select count(*)::integer from public.member where venue_id = '00000000-0000-4000-8000-0000000000f3'), 0, 'no member is left');
select is((select count(*)::integer from public.ledger_account where venue_id = '00000000-0000-4000-8000-0000000000f3' and member_id is not null), 0,
  'nor a member''s account');
select ok(exists (select 1 from public.ledger_account where venue_id = '00000000-0000-4000-8000-0000000000f3' and code = 'venue.cash_drawer'),
  'the venue''s own accounts stay, holding nothing');
select ok(exists (select 1 from public.tier where venue_id = '00000000-0000-4000-8000-0000000000f3')
          and exists (select 1 from public.staff where venue_id = '00000000-0000-4000-8000-0000000000f3'), 'and its setup and staff');
select ok(exists (select 1 from public.audit_log where venue_id = '00000000-0000-4000-8000-0000000000f3' and action = 'venue.purge'),
  'the purge is in the audit log, which it never deletes');
select ok(exists (select 1 from public.alert where venue_id = '00000000-0000-4000-8000-0000000000f3' and kind = 'venue.purged'), 'and the owner is alerted');
select ok(not exists (select 1 from public.control_state where member_id = '00000000-0000-4000-8000-0000000000f4'), 'the member''s freeze went with it');
select ok(not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-00000000e150'), 'and the member''s login');
select ok(not exists (select 1 from public.audit_log where venue_id = '00000000-0000-4000-8000-0000000000f3' and (before::text like '%Test Member%' or after::text like '%Test Member%')),
  'and the audit log keeps no member''s name');
select ok(exists (select 1 from public.audit_log where venue_id = '00000000-0000-4000-8000-0000000000f3' and entity = 'member'), 'though it keeps the rows that say what happened');
select ok(exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000134'), 'a staff member''s login stays');
select is((select (count(*), (select count(*) from public.ledger_entry where venue_id = '00000000-0000-4000-8000-000000000001'))::text
           from public.member where venue_id = '00000000-0000-4000-8000-000000000001'),
          (select (members, entries)::text from club_before), 'the club is untouched');

select * from finish();
rollback;
