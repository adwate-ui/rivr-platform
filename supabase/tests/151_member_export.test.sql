-- A member's own data export, built from what a member is owed (#498; question #493 X5; decision 0240). Every column of
-- every table naming a member is listed with what the export does, so a new one is a decision. Kunal (134, a super
-- admin) exports Kabir's (202) data: his freeze's reason is a staff note, apart from the freeze; at a bad beat he lost
-- to Naina (203) with Rohan (204) at the table, and the export names only Kabir.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- The tables a member's export draws on: any venue table with a member column, and the three it reaches through.
create temp table member_tables as
  select c.table_name::text as table_name from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and (c.column_name = 'member_id' or c.column_name like '%\_member\_id' or c.column_name like '%\_member\_ids')
    and exists (select 1 from information_schema.columns v where v.table_schema = 'public' and v.table_name = c.table_name and v.column_name = 'venue_id')
  union select unnest(array['member', 'ledger_entry', 'seat_move'])
  except select unnest(array['sar_entry', 'sar_entry_transaction']);
select is_empty($$ select c.table_name::text, c.column_name::text from information_schema.columns c
                   where c.table_schema = 'public' and c.table_name in (select table_name from member_tables)
                     and c.column_name not like '%\_hash'
                     and c.column_name not in ('encrypted_password', 'identity_key', 'aadhaar_reference', 'vendor_reference', 'digilocker_session_id')
                   except select table_name, column_name from private.member_export_columns() $$,
  'every column of every table naming a member is listed: owed, a staff note, another member''s or withheld');
select is_empty($$ select table_name, column_name from private.member_export_columns()
                   except select c.table_name::text, c.column_name::text from information_schema.columns c where c.table_schema = 'public' $$,
  'and every column listed is one there is');

-- Kabir's freeze, and the bad beat.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000202', 'Suspected chip dumping');
insert into public.jackpot_event (venue_id, kind, table_id, loser_member_id, winner_member_id, table_member_ids, pool_paise, loser_paise, winner_paise,
                                  each_at_table_paise, total_paise, rule, staff_id, idempotency_key)
select '00000000-0000-4000-8000-000000000001', 'payout', g.id, '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203',
       array['00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000204']::uuid[],
       10000000, 5000000, 2500000, 500000, 9000000, '{}'::jsonb, s.id, 'member-export-151'
from public.game_table g, public.staff s
where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2'
  and s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id = '00000000-0000-4000-8000-000000000134';

select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
create temp table plan as select public.start_export_archive('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') as plan;
create temp table entries as select t ->> 'name' as name, array(select jsonb_array_elements_text(t -> 'columns')) as columns
  from plan, jsonb_array_elements(plan -> 'tables') t;
select ok(exists (select 1 from entries where name = 'control_state' and not 'reason' = any(columns)), 'the freeze, without its reason');
select is((select columns from entries where name = 'staff-notes/control_state'), array['id', 'reason', 'release_reason'],
  'which is a staff note, apart, with the row''s id');
select ok(exists (select 1 from entries where name = 'kyc_record' and not 'same_face_as' = any(columns)), 'another member''s face match is never given');

create temp table beat as select public.export_archive_rows((select (plan ->> 'archive_id')::uuid from plan), 'jackpot_event') as page;
create temp table beat_row as
  select array(select jsonb_array_elements_text(r)) as cells, (select columns from entries where name = 'jackpot_event') as columns
  from beat, jsonb_array_elements(beat.page -> 'rows') r;
select is((select cells[array_position(columns, 'loser_member_id')] from beat_row), '00000000-0000-4000-8000-000000000202',
  'the bad beat names Kabir, the loser');
select is((select cells[array_position(columns, 'winner_member_id')] from beat_row), null, 'not Naina, who won');
select is((select cells[array_position(columns, 'table_member_ids')] from beat_row), '{00000000-0000-4000-8000-000000000202}',
  'and of the table only Kabir');

create temp table notes as select public.export_archive_rows((select (plan ->> 'archive_id')::uuid from plan), 'staff-notes/control_state') as page;
select is((select (page -> 'rows' -> 0 ->> 1) from notes), 'Suspected chip dumping', 'the staff note holds the reason');

select * from finish();
rollback;
