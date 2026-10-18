-- Rules every table follows (.claude/rules/database.md). These run against the whole schema, so a
-- lane's new table that forgets row-level security, venue_id or timestamps fails here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Code-declared catalogues shared by every venue (docs/decisions/0017-global-reference-tables.md).
create temporary table global_catalogue (name text) on commit drop;
insert into global_catalogue values ('role_permission'), ('feature'), ('setting_key');

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every public table has row-level security'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname not in (select name from global_catalogue) and c.relname <> 'venue'
       and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'venue_id' and not a.attisdropped) $$,
  'every public table except the venue itself and the global catalogues has venue_id'
);

select is_empty(
  $$ select c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and (select count(*) from pg_attribute a where a.attrelid = c.oid and a.attname in ('created_at', 'updated_at') and not a.attisdropped) < 2 $$,
  'every public table has created_at and updated_at'
);

select is_empty(
  $$ select table_name::text from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public' and table_name not like 'public\_%' $$,
  'the public role reads nothing except public_* views'
);

select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') $$,
  'the public role can call no function in the API schema'
);

select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')
       and p.proname not like 'public\_%' $$,
  'the public role can call no private helper except the public_* row functions'
);

select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and has_function_privilege('authenticated', p.oid, 'execute')
       and p.proname in ('post_ledger_transaction', 'reverse_ledger_transaction', 'emit', 'audit', 'bootstrap_venue') $$,
  'signed-in clients cannot post to the ledger, emit events, write the audit log or create venues'
);

select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%') $$,
  'every security-definer function pins its search_path'
);

select * from finish();
rollback;
