-- Exports from the console's tables (#102; decision 0190). Aditya (103, an admin) exports the members found
-- by a search, filtered to a tier: the audit log records who, what, the filters, the format and the rows. An
-- export of 1,000 rows or more alerts the owner, or of the venue's exports.alert_rows. Farhan (190, the front
-- desk) exports nothing; Nisha (191, an admin at the club only) nothing of the practice venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000190');
select throws_ok($$ select public.record_table_export('00000000-0000-4000-8000-000000000001', 'Members', '', 'csv', 3) $$, '42501', null,
  'the front desk exports no tables');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.record_table_export('00000000-0000-4000-8000-000000000001', 'Members', 'Search: 9000; Tier: Black card', 'csv', 12), false,
  'Aditya exports twelve members of a tier: recorded, not large');
reset role;
select results_eq($$ select actor_user_id, entity, entity_id, after from public.audit_log where action = 'export.table' order by id desc limit 1 $$,
  $$ values ('00000000-0000-4000-8000-000000000103'::uuid, 'table'::text, 'Members'::text,
             '{"format": "csv", "filter": "Search: 9000; Tier: Black card", "rows": 12}'::jsonb) $$,
  'the audit log has who, what, the filters, the format and the rows');
select is_empty($$ select 1 from public.alert where kind = 'export.large' $$, 'and no alert');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.record_table_export('00000000-0000-4000-8000-000000000001', 'Pot data', '', 'xlsx', 1000), true, 'a thousand rows is large');
reset role;
select results_eq($$ select detail from public.alert where kind = 'export.large' and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values ('{"what": "Pot data", "format": "xlsx", "rows": 1000}'::jsonb) $$, 'and alerts the owner, with no personal data');

-- Set by the database: only a super admin changes it from the console (#112).
select set_config('request.jwt.claims', '', true);
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'exports.alert_rows', '', '{"rows": 10}', now() - interval '1 minute', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.record_table_export('00000000-0000-4000-8000-000000000001', 'Members', '', 'csv', 12), true, 'the venue can alert from fewer rows');

select throws_ok($$ select public.record_table_export('00000000-0000-4000-8000-000000000001', 'Members', '', 'pdf', 3) $$, '22023', null, 'CSV or XLSX only');
select throws_ok($$ select public.record_table_export('00000000-0000-4000-8000-000000000001', 'Members', '', 'csv', -1) $$, '22023', null, 'no fewer than no rows');
select throws_ok($$ select public.record_table_export('00000000-0000-4000-8000-000000000001', ' ', '', 'csv', 3) $$, '22023', null, 'a table by name');

select pg_temp.as_person('00000000-0000-4000-8000-000000000191');
select throws_ok($$ select public.record_table_export('00000000-0000-4000-8000-000000000002', 'Members', '', 'csv', 3) $$, '42501', null,
  'Nisha exports nothing of another venue');

-- Every member of a tier (flow 20).
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temporary table member_tier as
select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member';
select ok((select count(*) > 0 from public.members_of_tier('00000000-0000-4000-8000-000000000001', (select id from member_tier))),
  'Aditya lists every member of the Member tier');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001', (select id from member_tier)) where tier_name <> 'Member' $$,
  'and only of that tier');
select is((select count(*)::integer from public.members_of_tier('00000000-0000-4000-8000-000000000001', (select id from member_tier))),
  (select count(*)::integer from public.member m where m.venue_id = '00000000-0000-4000-8000-000000000001' and m.tier_id = (select id from member_tier)),
  'all of them, not the first page of a search');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.members_of_tier('00000000-0000-4000-8000-000000000001', (select id from member_tier)) $$,
  'a dealer, who reads no members, lists none');

select * from finish();
rollback;
