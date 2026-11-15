-- The Waitlist as one list from the server, and Activity by numbered pages (redesign RD-31). Vikram (101) is a super
-- admin; Pema (106), a dealer, reads neither. Each page is checked against the read that gave the list before:
-- waitlist_board, and activity_log.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- The tables whose lists hold someone, and a few more lines in the log so that it has a second page of two.
create temporary table listed as
select g.id, g.name, g.position from public.game_table g
where g.venue_id = '00000000-0000-4000-8000-000000000001'
  and exists (select 1 from public.waitlist_entry e where e.table_id = g.id and e.status = 'waiting');
grant select on listed to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');

-- The Waitlist.
select ok((select count(*) > 0 from public.waitlist_board('00000000-0000-4000-8000-000000000001')), 'the seed has members waiting');
select set_eq($$ select entry_id from public.waitlist_page('00000000-0000-4000-8000-000000000001') $$,
  $$ select entry_id from public.waitlist_board('00000000-0000-4000-8000-000000000001') $$, 'the page holds every place, while they fit one page');
select is_empty($$ select 1 from public.waitlist_page('00000000-0000-4000-8000-000000000001') p
                   full join public.waitlist_board('00000000-0000-4000-8000-000000000001') b on b.entry_id = p.entry_id
                   where (p.entry_id, p.table_type_id, p.member_id, p.full_name, p.joined_at, p.place, p.added_by_floor, p.priority_reason, p.call_table_name,
                          p.call_seat, p.hold_until, p.away_until, p.asked_table_id, p.on_way_at, p.needs_id_check)
                         is distinct from
                         (b.entry_id, b.table_type_id, b.member_id, b.full_name, b.joined_at, b.place, b.added_by_floor, b.priority_reason, b.call_table_name,
                          b.call_seat, b.hold_until, b.away_until, b.asked_table_id, b.on_way_at, b.needs_id_check) $$, 'each place as the board gave it');
select results_eq($$ select entry_id from public.waitlist_page('00000000-0000-4000-8000-000000000001') $$,
  $$ select b.entry_id from public.waitlist_board('00000000-0000-4000-8000-000000000001') b join listed g on g.id = b.asked_table_id
     order by g.position, g.name, b.place $$, 'table by table, each list in its own order');
select is((select distinct total from public.waitlist_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1}')),
  (select count(*) from public.waitlist_board('00000000-0000-4000-8000-000000000001')), 'a page of one says how many wait in all');
select set_eq($$ select entry_id from public.waitlist_page('00000000-0000-4000-8000-000000000001',
                   jsonb_build_object('scope', jsonb_build_object('table', (select id from listed order by position limit 1)))) $$,
  $$ select entry_id from public.waitlist_board('00000000-0000-4000-8000-000000000001') where asked_table_id = (select id from listed order by position limit 1) $$,
  'one table''s list alone, when the screen asks for it');
select set_eq($$ select entry_id from public.waitlist_page('00000000-0000-4000-8000-000000000001',
                   jsonb_build_object('filters', jsonb_build_object('table', jsonb_build_object('kind', 'choice', 'chosen', jsonb_build_array((select name from listed order by position limit 1)))))) $$,
  $$ select entry_id from public.waitlist_board('00000000-0000-4000-8000-000000000001') where asked_table_id = (select id from listed order by position limit 1) $$,
  'or by the Table column''s filter');
select set_eq($$ select entry_id from public.waitlist_page('00000000-0000-4000-8000-000000000001', '{"query": "an"}') $$,
  $$ select entry_id from public.waitlist_board('00000000-0000-4000-8000-000000000001') where full_name ilike '%an%' $$, 'the search reads the name');
select results_eq($$ select value, members from public.list_choices('waitlist', '00000000-0000-4000-8000-000000000001') where column_key = 'table' order by value $$,
  $$ select g.name, count(*) from public.waitlist_board('00000000-0000-4000-8000-000000000001') b join listed g on g.id = b.asked_table_id group by 1 order by 1 $$,
  'the Table menu counts each table''s list');

-- Activity.
select ok((select count(*) >= 4 from public.activity_log('00000000-0000-4000-8000-000000000001', p_limit => 200)), 'the log has lines');
select results_eq($$ select id from public.activity_page('00000000-0000-4000-8000-000000000001', p_page_size => 3) $$,
  $$ select id from public.activity_log('00000000-0000-4000-8000-000000000001', p_limit => 3) $$, 'the first page is the newest lines, as before');
select results_eq($$ select id from public.activity_page('00000000-0000-4000-8000-000000000001', p_page => 2, p_page_size => 2) $$,
  $$ select id from public.activity_log('00000000-0000-4000-8000-000000000001', p_limit => 4) offset 2 $$, 'the second page of two follows the first');
select is_empty($$ select 1 from public.activity_page('00000000-0000-4000-8000-000000000001', p_page_size => 200) p
                   join public.activity_log('00000000-0000-4000-8000-000000000001', p_limit => 200) l on l.id = p.id
                   where (p.occurred_at, p.who, p.is_system, p.action, p.entity, p.kind, p.about, p.reason, p.amount)
                         is distinct from (l.occurred_at, l.who, l.is_system, l.action, l.entity, l.kind, l.about, l.reason, l.amount) $$, 'each line as it was');
select is((select distinct total from public.activity_page('00000000-0000-4000-8000-000000000001', p_page_size => 2)),
  (select count(*) from public.audit_log where venue_id = '00000000-0000-4000-8000-000000000001'), 'a page says how many lines there are in all');
select is((select distinct total from public.activity_page('00000000-0000-4000-8000-000000000001', p_kind => 'staff', p_page_size => 1)),
  (select count(*) from public.activity_log('00000000-0000-4000-8000-000000000001', p_kind => 'staff', p_limit => 200)), 'and how many of a kind');
select is((select count(*) from public.activity_page('00000000-0000-4000-8000-000000000001', p_from => '2020-01-01', p_to => '2020-01-02')), 0::bigint,
  'days long ago hold nothing');
select is((select count(*) from public.activity_page('00000000-0000-4000-8000-000000000001', p_page_size => 5000)), least(1000, (select count(*) from public.audit_log where venue_id = '00000000-0000-4000-8000-000000000001')),
  'a page is a thousand lines at most');

-- A dealer reads neither.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.waitlist_page('00000000-0000-4000-8000-000000000001') $$, 'a dealer is given no place');
select is_empty($$ select 1 from public.list_choices('waitlist', '00000000-0000-4000-8000-000000000001') $$, 'no counts');
select is_empty($$ select 1 from public.activity_page('00000000-0000-4000-8000-000000000001') $$, 'and no line of the log');
reset role;
select is(has_function_privilege('anon', 'public.waitlist_page(uuid, jsonb)', 'execute')
       or has_function_privilege('anon', 'public.activity_page(uuid, date, date, text, text, integer, integer)', 'execute'), false, 'nobody signed out reads either');
select is(has_table_privilege('authenticated', 'private.activity_line', 'select') or has_table_privilege('anon', 'private.activity_line', 'select'), false,
  'and the log''s lines are reached only through its pages');

select * from finish();
rollback;
