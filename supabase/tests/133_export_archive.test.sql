-- The super admin's export archive (#103; decision 0232). Vikram (101, the owner, a super admin) starts the club's
-- archive: the audit log records who, the venue and each table's rows, counted here, and the owner is alerted when
-- it is large. He gets every table with its columns, secrets left out, and the owner's backup key to encrypt it to;
-- then he reads each table a page at a time, in primary key order, with the archive's id, within the hour. No one
-- else reads his archive. One member's archive holds that member's rows only. Aditya (103, an admin) starts none,
-- nor changes the key; none is started until the key is set; KYC photos need a written reason.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Reads one table of an archive a page at a time, as the browser does: how many rows, and how many distinct.
create function pg_temp.read_all(p_archive_id uuid, p_table text, p_page integer)
returns table (total integer, different integer)
language plpgsql as $$
declare
  v_after jsonb;
  v_page jsonb;
  v_rows jsonb := '[]';
begin
  loop
    v_page := public.export_archive_rows(p_archive_id, p_table, v_after, p_page);
    v_rows := v_rows || (v_page -> 'rows');
    v_after := v_page -> 'after';
    exit when v_after is null or v_after = 'null'::jsonb;
  end loop;
  return query select jsonb_array_length(v_rows), (select count(distinct r)::integer from jsonb_array_elements(v_rows) r);
end;
$$;
grant execute on function pg_temp.read_all(uuid, text, integer) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.start_export_archive('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'an admin starts no archive');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.export_archive_rows(gen_random_uuid(), 'member', null, 10) $$, '42501', null,
  'no table is read without an archive started');

-- Started: recorded first, with each table's rows; large, so the owner hears.
create temp table started as select public.start_export_archive('00000000-0000-4000-8000-000000000001') as p;
create temp table archive as select (p ->> 'archive_id')::uuid as id from started;
select is((select p ->> 'recipient' from started), 'age1wy5nka0c35w4a47qnvvwcsedlatfs5y67uzqhwrnd5pmae56h9vs77k5za',
  'the archive is encrypted to the owner''s backup key');
reset role;
select is((select jsonb_array_length(p -> 'tables') from started),
  (select count(*)::integer from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'),
  'every table is in it, those staff cannot read too');
select results_eq($$ select actor_user_id, entity, entity_id, (after -> 'counts' ->> 'member')::integer, after ->> 'kyc_photos', after ->> 'archive'
                     from public.audit_log where action = 'export.archive' order by id desc limit 1 $$,
  $$ select '00000000-0000-4000-8000-000000000101'::uuid, 'venue'::text, '00000000-0000-4000-8000-000000000001'::text,
            (select count(*)::integer from public.member where venue_id = '00000000-0000-4000-8000-000000000001'), 'false'::text,
            (select id::text from archive) $$,
  'the audit log has who, the venue, each table''s rows counted by the database, and the archive');
select results_eq($$ select detail ->> 'what', detail ->> 'format' from public.alert where kind = 'export.large' order by created_at desc limit 1 $$,
  $$ values ('Full archive'::text, 'archive'::text) $$, 'the club''s thousands of rows alert the owner, with no personal data');
select is_empty($$ select 1 from started, jsonb_array_elements(p -> 'tables') t, jsonb_array_elements_text(t -> 'columns') c
                   where c like '%\_hash' or c in ('identity_key', 'aadhaar_reference', 'vendor_reference', 'digilocker_session_id') $$,
  'no PIN, token or code hash and no KYC key leaves the database');
select ok((select p -> 'tables' @> '[{"name": "staff_credential"}, {"name": "device"}]' from started), 'the tables holding them come without them');
select is((select t -> 'columns' -> 0 from started, jsonb_array_elements(p -> 'tables') t where t ->> 'name' = 'member'), '"id"'::jsonb,
  'each table with its columns in order');

-- The rows, a page at a time, each once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select * from pg_temp.read_all((select id from archive), 'member', 7) $$,
  $$ select count(*)::integer, count(*)::integer from public.member where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'every member of the club, read seven at a time, each once');
select results_eq($$ select * from pg_temp.read_all((select id from archive), 'ledger_entry', 50) $$,
  $$ select count(*)::integer, count(*)::integer from public.ledger_entry where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'and every ledger entry, by its number');
select results_eq($$ select * from pg_temp.read_all((select id from archive), 'role_permission', 25) $$,
  $$ select count(*)::integer, count(*)::integer from public.role_permission $$,
  'a table with no venue (what each role may do) whole, by its two-part key');
select is((public.export_archive_rows((select id from archive), 'venue', null, 10) -> 'rows') -> 0 ->> 0,
  '00000000-0000-4000-8000-000000000001', 'the venue table holds the club alone, not the practice venue');
select is(jsonb_array_length(public.export_archive_rows((select id from archive), 'venue', null, 10) -> 'rows'), 1, 'one row');
select matches((select c from jsonb_array_elements_text(public.export_archive_rows((select id from archive), 'member', null, 1) -> 'rows' -> 0) c
  where c ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}' limit 1), '\+00$', 'cells are written as the database writes them, times in UTC');
select throws_ok($$ select public.export_archive_rows((select id from archive), 'member; drop table public.member', null, 10) $$,
  '22023', null, 'a name that is not a table reads nothing');
select throws_ok($$ select public.export_archive_rows((select id from archive), 'member', null, 5001) $$,
  '22023', null, 'pages of 5,000 rows at most');

-- His archive is his, for an hour.
grant select on archive to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select public.export_archive_rows((select id from archive), 'member', null, 10) $$, '42501', null,
  'another super admin does not read his archive');
reset role;
update private.export_archive set expires_at = now() - interval '1 second' where id = (select id from archive);
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.export_archive_rows((select id from archive), 'member', null, 10) $$, '42501', null,
  'nor does he, an hour on');

-- One member, for an access request: Arjun's rows only.
create temp table arjun as select public.start_export_archive('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201') as p;
create temp table arjun_archive as select (p ->> 'archive_id')::uuid as id from arjun;
select ok((select p -> 'tables' @> '[{"name": "ledger_entry"}, {"name": "jackpot_event"}, {"name": "kyc_record"}, {"name": "seat_move"}]' from arjun),
  'his archive holds his ledger, his jackpots, his KYC and his seat moves');
select ok((select not p -> 'tables' @> '[{"name": "staff"}]' and not p -> 'tables' @> '[{"name": "venue"}]' from arjun),
  'and no table that is not about him');
select results_eq($$ select total from pg_temp.read_all((select id from arjun_archive), 'member', 10) $$, $$ values (1) $$, 'his member row alone');
select results_eq($$ select total from pg_temp.read_all((select id from arjun_archive), 'ledger_entry', 10) $$,
  $$ select count(*)::integer from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
     where a.member_id = '00000000-0000-4000-8000-000000000201' $$, 'every entry on his accounts');
select results_eq($$ select total from pg_temp.read_all((select id from arjun_archive), 'jackpot_event', 10) $$,
  $$ select count(*)::integer from public.jackpot_event j where j.venue_id = '00000000-0000-4000-8000-000000000001'
     and ('00000000-0000-4000-8000-000000000201' in (j.winner_member_id, j.loser_member_id) or '00000000-0000-4000-8000-000000000201' = any(j.table_member_ids)) $$,
  'every jackpot he won, lost or sat at');
select throws_ok($$ select public.export_archive_rows((select id from arjun_archive), 'staff', null, 10) $$,
  '22023', null, 'a table not about him reads nothing');
reset role;
select results_eq($$ select action, entity, entity_id from public.audit_log where action like 'export.%' order by id desc limit 1 $$,
  $$ values ('export.member'::text, 'member'::text, '00000000-0000-4000-8000-000000000201'::text) $$, 'recorded against him');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.start_export_archive('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301') $$,
  'P0002', null, 'a member of another venue is not exported from this one');

-- KYC photos: a full archive only, with a written reason.
select throws_ok($$ select public.start_export_archive('00000000-0000-4000-8000-000000000001', null, 'Police') $$, '22023', null,
  'KYC photos need a written reason');
select throws_ok($$ select public.start_export_archive('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'Access request from the member') $$,
  '22023', null, 'and go in the full archive only');
select lives_ok($$ select public.start_export_archive('00000000-0000-4000-8000-000000000001', null, 'Police request, case 41 of 2026') $$,
  'with a reason, they go in');
reset role;
select results_eq($$ select after ->> 'kyc_photos', reason from public.audit_log where action = 'export.archive' order by id desc limit 1 $$,
  $$ values ('true'::text, 'Police request, case 41 of 2026'::text) $$, 'and the reason is in the audit log');

-- The key: a super admin's to change, and the owner hears.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'exports.archive_recipient', '', '{"recipient": "age1wy5nka0c35w4a47qnvvwcsedlatfs5y67uzqhwrnd5pmae56h9vs77k5za"}',
          now() + interval '1 day', 'My key') $$, '42501', null, 'an admin who changes settings does not change the archive''s key');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'exports.archive_recipient', '', '{"recipient": "age1wy5nka0c35w4a47qnvvwcsedlatfs5y67uzqhwrnd5pmae56h9vs77k5za"}',
          now() + interval '1 day', 'New backup key') $$, 'a super admin does');
reset role;
select ok(exists (select 1 from public.alert where kind = 'exports.key_changed' and venue_id = '00000000-0000-4000-8000-000000000001'),
  'and the owner is alerted');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000002', 'exports.archive_recipient', '', '{"recipient": "ssh-ed25519 AAAA"}', now() + interval '1 day', 'Test') $$,
  null, null, 'the key is an age public key');

-- No key, no archive: the practice venue's is taken away.
delete from public.setting where venue_id = '00000000-0000-4000-8000-000000000002' and key = 'exports.archive_recipient';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.start_export_archive('00000000-0000-4000-8000-000000000002') $$, 'RVKEY', null,
  'no archive is started until the owner''s backup key is set');
reset role;

select ok(not has_function_privilege('anon', 'public.export_archive_rows(uuid, text, jsonb, integer)', 'execute'), 'nobody signed out reads a table');
select ok(not has_function_privilege('authenticated', 'private.export_archive_tables(boolean)', 'execute'), 'nor sees the list of tables directly');
select ok(not has_table_privilege('authenticated', 'private.export_archive', 'select'), 'nor the archives started');

select * from finish();
rollback;
