-- Purge a live venue (#432; decision 0239). A throwaway venue, "Test Room", with Kunal (134) as its super admin and one
-- member, with a login, a deposit, a freeze, a KYC photo and a receipt in storage. Kunal cannot purge it before it is
-- frozen, nor without an archive made after the freeze with the KYC photos, read to its end in order and saved, nor once
-- a row is added or changed since, nor with the wrong name; then he purges it: the member, the deposit, its ledger
-- entries, the freeze and the member's login go, and the audit log keeps no member's name nor the freeze's reason; the
-- venue's own accounts, its setup and the audit log stay, the owner is alerted, and the club is untouched. Then the files
-- the archive held go, at his asking alone, and never one a row names again or one the archive could not read. The
-- practice venue resets instead; a cashier purges nothing.
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
  $$ select unnest(array['academy_batch', 'academy_booking', 'academy_utr_rejection', 'account_transfer', 'alert', 'bonus_grant', 'buy_in_request', 'cab_request',
     'cage_shift', 'cage_transaction', 'chip_inventory_count', 'chip_inventory_line', 'consent', 'credit_line', 'dealer_down', 'deposit_request',
     'down_count', 'early_departure', 'eod_close', 'expense', 'feedback', 'fnb_order', 'hand', 'high_hand_claim', 'incident', 'invoice', 'invoice_counter',
     'jackpot_event', 'kyc_record', 'kyc_review', 'league_finish', 'ledger_account', 'ledger_entry', 'ledger_transaction', 'marker',
     'marker_settlement', 'member', 'member_feature_override', 'member_limit', 'member_preference', 'member_tier_change', 'membership_card',
     'mis_report', 'notification_preference', 'outbox_delivery', 'outbox_event', 'payout_account', 'points_earning', 'promotion',
     'promotion_budget', 'promotion_grant', 'promotion_rule', 'redemption', 'referral', 'review_request', 'sar_entry', 'sar_entry_transaction', 'seat_move', 'seat_session',
     'second_approval', 'self_exclusion', 'sign_up_attribution', 'staff_attendance', 'staff_shift', 'tds_withholding', 'tournament',
     'tournament_entry', 'tournament_payout', 'tournament_purchase', 'tournament_ticket', 'visit', 'waitlist_entry', 'withdrawal_request']) $$,
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
-- The venue's files in storage: a KYC photo and a receipt, one photo the archive will not read, and another venue's.
insert into storage.objects (bucket_id, name) values
  ('kyc', '00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000f4/selfie.jpg'),
  ('kyc', '00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000f4/gone.jpg'),
  ('expense-receipts', '00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000e1.jpg'),
  ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000211/selfie.jpg')
on conflict do nothing;
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

-- Pages are handed out in order: one asked for out of turn is refused, so no table is marked read unless read to its end.
reset role;
insert into private.export_archive (id, venue_id, started_by, counts)
values ('00000000-0000-4000-8000-0000000000f7', '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-000000000134', '{"member": 1}');
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select public.export_archive_rows('00000000-0000-4000-8000-0000000000f7', 'member', '{"id": "ffffffff-ffff-4fff-8fff-ffffffffffff"}', 1) $$,
  '22023', null, 'an archive''s pages are read in order, from the first');
create temp table first_page as select public.export_archive_rows('00000000-0000-4000-8000-0000000000f7', 'member', null, 1) as page;
select lives_ok($$ select public.export_archive_rows('00000000-0000-4000-8000-0000000000f7', 'member', null, 1) $$, 'the last page may be asked again');
select lives_ok($$ select public.export_archive_rows('00000000-0000-4000-8000-0000000000f7', 'member', (select page -> 'after' from first_page), 1) $$,
  'and the next page is the one after it');
reset role;
select ok((select 'member' = any(tables_read) from private.export_archive where id = '00000000-0000-4000-8000-0000000000f7'),
  'the table is read once its last page comes back short');

-- The archive, made after the freeze with the KYC photos, read and saved; the server listed the venue's files.
insert into private.export_archive (id, venue_id, started_by, counts, kyc_reason, files_listed)
values ('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-000000000134',
        (select jsonb_object_agg(t, private.venue_row_count('00000000-0000-4000-8000-0000000000f3', t)) from private.live_purge_tables() t),
        'Purging the test room: the only copy',
        array['expense-receipts/00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000e1.jpg',
              'kyc/00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000f4/gone.jpg',
              'kyc/00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000f4/selfie.jpg']);
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.complete_export_archive('00000000-0000-4000-8000-0000000000f5', 'abababababababababababababababababababababababababababababababab', 1024) $$, '22023', null, 'only its maker marks it saved');
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select public.complete_export_archive('00000000-0000-4000-8000-0000000000f5', 'abababababababababababababababababababababababababababababababab', 1024) $$, '22023', null, 'and only once every table is read to its end');
reset role;
update private.export_archive set tables_read = array(select jsonb_object_keys(counts)) where id = '00000000-0000-4000-8000-0000000000f5';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select public.complete_export_archive('00000000-0000-4000-8000-0000000000f5', 'not a hash', 1024) $$, '22023', null, 'with the file''s SHA-256 and size');
select throws_ok($$ select public.complete_export_archive('00000000-0000-4000-8000-0000000000f5', 'abababababababababababababababababababababababababababababababab', 1024,
  array['kyc/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000211/selfie.jpg']) $$, '22023', null,
  'the files it could not read are ones it listed');
select lives_ok($$ select public.complete_export_archive('00000000-0000-4000-8000-0000000000f5', 'abababababababababababababababababababababababababababababababab', 1024,
  array['kyc/00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000f4/gone.jpg']) $$, 'its maker marks it saved, with the one it could not read');
reset role;
select is((select cardinality(files_held) from private.export_archive where id = '00000000-0000-4000-8000-0000000000f5'), 2, 'it holds the other two files');
update private.export_archive set kyc_reason = null where id = '00000000-0000-4000-8000-0000000000f5';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-0000000000f3', 'Test Room') $$, 'RVARC', null,
  'not with an archive left without the KYC photos');
reset role;
update private.export_archive set kyc_reason = 'Purging the test room: the only copy', started_at = now() - interval '1 minute'
where id = '00000000-0000-4000-8000-0000000000f5';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-0000000000f3', 'Test Room') $$, 'RVCHG', null,
  'nor once a row changed after the archive began');
reset role;
update private.export_archive set started_at = now() where id = '00000000-0000-4000-8000-0000000000f5';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
reset role;
update private.export_archive set counts = counts || '{"member": 99}' where id = '00000000-0000-4000-8000-0000000000f5';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-0000000000f3', 'Test Room') $$, 'RVCHG', null, 'not once the venue has changed since the archive');
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
select ok(not exists (select 1 from public.audit_log where venue_id = '00000000-0000-4000-8000-0000000000f3' and (before::text like '%Test freeze%' or after::text like '%Test freeze%')),
  'nor why the member was frozen');
select ok(exists (select 1 from public.audit_log where venue_id = '00000000-0000-4000-8000-0000000000f3' and entity = 'member'), 'though it keeps the rows that say what happened');
select ok(exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000134'), 'a staff member''s login stays');
select is((select (count(*), (select count(*) from public.ledger_entry where venue_id = '00000000-0000-4000-8000-000000000001'))::text
           from public.member where venue_id = '00000000-0000-4000-8000-000000000001'),
          (select (members, entries)::text from club_before), 'the club is untouched');

-- The files: only those the archive held, at the asking of the venue's super admin, and never one a row names again.
-- The same member back (an id is a person's own), whose new KYC row names the photo the purge would remove.
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000f3', 'Returning Member', '+919000000995');
insert into public.kyc_record (venue_id, member_id, photo_path)
values ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000f4/selfie.jpg');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.purge_files_due('00000000-0000-4000-8000-0000000000f3') $$, '42501', null, 'a cashier removes no file');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.purge_files_due('00000000-0000-4000-8000-0000000000f3') $$, '42501', null, 'nor another venue''s super admin');
reset role;
insert into public.control_state (venue_id, level, staff_id, reason)
select '00000000-0000-4000-8000-0000000000f3', 'access_revoke', s.id, 'Test revoke' from public.staff s
where s.user_id = '00000000-0000-4000-8000-000000000134' and s.venue_id = '00000000-0000-4000-8000-0000000000f3';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select throws_ok($$ select * from public.purge_files_due('00000000-0000-4000-8000-0000000000f3') $$, '42501', null,
  'nor the venue''s super admin while their access is revoked');
reset role;
update public.control_state set released_at = now(), release_reason = 'Test over',
  released_by_staff_id = (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000134' and venue_id = '00000000-0000-4000-8000-0000000000f3')
where venue_id = '00000000-0000-4000-8000-0000000000f3' and level = 'access_revoke' and released_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select set_eq($$ select * from public.purge_files_due('00000000-0000-4000-8000-0000000000f3') $$,
  $$ values ('expense-receipts/00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000e1.jpg') $$,
  'the receipt is due: not the photo the archive could not read, nor one a new row names');
select throws_ok($$ select public.purge_files_done('00000000-0000-4000-8000-0000000000f3',
  array['kyc/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000211/selfie.jpg'], 0) $$, '22023', null,
  'only files the purge left are noted removed');
select throws_ok($$ select public.purge_files_done('00000000-0000-4000-8000-0000000000f3',
  array['expense-receipts/00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000e1.jpg'], 0) $$, '22023', null,
  'nor one still in Storage');
select throws_ok($$ select public.purge_files_done('00000000-0000-4000-8000-0000000000f3', array[null]::text[], 0) $$, '22023', null,
  'nor nothing dressed as a file');
select is(public.purge_files_left_count('00000000-0000-4000-8000-0000000000f3'), 1, 'the Purge screen, opened again, sees one file left');
-- Storage removes the receipt, as the Edge Function asks it to.
reset role;
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'expense-receipts' and name = '00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000e1.jpg';
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select is(public.purge_files_done('00000000-0000-4000-8000-0000000000f3',
  array['expense-receipts/00000000-0000-4000-8000-0000000000f3/00000000-0000-4000-8000-0000000000e1.jpg'], 0), 0, 'once removed, none is left');
select is_empty($$ select * from public.purge_files_due('00000000-0000-4000-8000-0000000000f3') $$, 'and none is due again');
reset role;
select ok(exists (select 1 from public.audit_log where venue_id = '00000000-0000-4000-8000-0000000000f3' and action = 'venue.purge_files'),
  'the audit log says what went');

-- The whole way, as the console goes: the archive started (so it alerts the owner of a large export, writing to the
-- venue's alerts and outbox), every table read in order, saved, then the purge. Those writes do not block it.
reset role;
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f8', 'Test Room Two', 'test-room-two', false, 'Test Room Two LLP', 'Gurugram', 'TSB');
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
select '00000000-0000-4000-8000-0000000000f8', s.user_id, s.full_name, s.job_title, 'super_admin', s.phone
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000134' and s.venue_id = '00000000-0000-4000-8000-000000000001';
insert into public.setting (venue_id, key, subject, value, effective_from, reason) values
  ('00000000-0000-4000-8000-0000000000f8', 'exports.archive_recipient', '', '{"recipient": "age1wy5nka0c35w4a47qnvvwcsedlatfs5y67uzqhwrnd5pmae56h9vs77k5za"}', now(), 'Test key'),
  ('00000000-0000-4000-8000-0000000000f8', 'exports.alert_rows', '', '{"rows": 1}', now(), 'Alert on any export');
insert into public.control_state (venue_id, level, reason, engaged_at)
values ('00000000-0000-4000-8000-0000000000f8', 'venue_freeze', 'Purging test room two', now() - interval '10 minutes');
create function pg_temp.read_whole(p_plan jsonb) returns void language plpgsql as $$
declare
  v_table text;
  v_after jsonb;
  v_page jsonb;
begin
  for v_table in select t ->> 'name' from jsonb_array_elements(p_plan -> 'tables') t loop
    v_after := null;
    loop
      v_page := public.export_archive_rows((p_plan ->> 'archive_id')::uuid, v_table, v_after, 5000);
      v_after := v_page -> 'after';
      exit when v_after is null or v_after = 'null'::jsonb;
    end loop;
  end loop;
end;
$$;
grant execute on function pg_temp.read_whole(jsonb) to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
create temp table plan as select public.start_export_archive('00000000-0000-4000-8000-0000000000f8', null, 'Purging test room two: the only copy') as plan;
select lives_ok($$ select pg_temp.read_whole((select plan from plan)) $$, 'every table is read, page by page');
select lives_ok($$ select public.complete_export_archive(((select plan from plan) ->> 'archive_id')::uuid,
  'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd', 2048, '{}') $$, 'and the archive saved');
reset role;
select ok(exists (select 1 from public.alert where venue_id = '00000000-0000-4000-8000-0000000000f8' and kind = 'export.large'),
  'making it alerted the owner, after counting');
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select lives_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-0000000000f8', 'Test Room Two') $$,
  'and the purge goes through all the same');

select * from finish();
rollback;
