-- The nightly backup's role (#25, decision 0072): it reads every table, past row-level security, and can
-- write nothing, become nobody else, and sign in only once the owner gives it a password. That a backup
-- needs no more is proved by scripts/backup/check-backup.sh in CI.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(exists (select 1 from pg_roles where rolname = 'rivr_backup' and rolbypassrls and not rolcanlogin), 'rivr_backup bypasses row-level security and can''t sign in yet');
select ok(exists (select 1 from pg_roles where rolname = 'rivr_backup' and not (rolsuper or rolcreaterole or rolcreatedb or rolreplication)),
  'it can create nothing and replicate nothing');
select ok(pg_has_role('rivr_backup', 'pg_read_all_data', 'member'), 'it reads all data');
select ok(not pg_has_role('rivr_backup', 'pg_write_all_data', 'member'), 'and writes none');
select ok(not pg_has_role('rivr_backup', 'postgres', 'member') and not pg_has_role('rivr_backup', 'service_role', 'member'),
  'it can''t become postgres or the service role');
select ok(has_table_privilege('rivr_backup', 'public.kyc_record', 'select') and has_table_privilege('rivr_backup', 'auth.users', 'select'),
  'it reads KYC records and auth''s users');
select ok(not has_table_privilege('rivr_backup', 'public.ledger_entry', 'insert') and not has_table_privilege('rivr_backup', 'public.member', 'update')
          and not has_table_privilege('rivr_backup', 'public.audit_log', 'delete'),
  'it never writes the ledger, members or the audit log');
select is_empty($$ select 1 from information_schema.role_table_grants where grantee = 'rivr_backup' $$, 'no table is granted to it directly');

select * from finish();
rollback;
