-- Joining is a request (#633). A join from the app waits for the floor (waitlist.manage: 103 Aditya), which approves it
-- onto the list, in the order the member asked, or removes it; the floor's own adds are on the list at once. A member waits
-- for one game at a time. Tonight's tables say each game's call time. 211 Ishaan, 212 Vihaan and 213 Mihir have finished
-- their identity check; 106 Pema is a dealer. The seed puts Kabir, Naina and Rohan on Table 2's list (100/200; a list per
-- table, decision 0433).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- This test's club night began twelve hours before it (#716). The night turns at 06:00 IST (private.tonight_began), so a
-- run just after 06:00 would put the joins and visits made minutes earlier on last night's side; the turn itself is 043's
-- and 220's to test. Here tonight_began keeps its rule, with the turn moved to twelve hours ago, until the test rolls back.
create temp table night_shift on commit drop as select now() - private.tonight_began(now()) - interval '12 hours' as shift;
grant select on night_shift to authenticated, anon, service_role;
create or replace function private.tonight_began(p_at timestamptz) returns timestamptz language sql stable set search_path = '' as $$
  select ((date_trunc('day', ((p_at - s.shift) at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata')
         + s.shift
  from pg_temp.night_shift s;
$$;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.type_id(p_code text) returns uuid language sql as $$
  select id from public.table_type where code = p_code and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.table_id(text) to authenticated;
grant execute on function pg_temp.as_person(text), pg_temp.type_id(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- Ishaan and Mihir ask to join Table 2's list from the app.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'ishaan', public.join_waitlist_at(pg_temp.table_id('Table 2'), gen_random_uuid());
select results_eq($$ select place, is_request from public.my_waitlist() $$, $$ values (null::integer, true) $$,
  'Ishaan''s join is a request, with no place yet');
select throws_ok($$ select public.join_waitlist_at(pg_temp.table_id('Table 1'), gen_random_uuid()) $$, 'RVONE', null,
  'and he asks for one game at a time');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'mihir', public.join_waitlist_at(pg_temp.table_id('Table 2'), gen_random_uuid());
reset role;
-- One transaction gives every row the same time: Ishaan asked a minute before Mihir.
update public.waitlist_entry set joined_at = now() - interval '1 minute' where id = (select id from ids where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select l.waiting, l.call_time_minutes from public.waitlist_lengths() l where l.table_id = pg_temp.table_id('Table 2') $$,
  $$ values (3, 180) $$, 'Home counts only the three on the table''s list, and says the stake''s three hours of call time');
select is((select l.waiting from public.waitlist_lengths() l where l.table_id = pg_temp.table_id('Table 3')), 0,
  'another table at the stake has a list of its own');
reset role;

-- The floor sees both, oldest first, on no list until approved; a dealer sees none and approves none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.waitlist_requests('00000000-0000-4000-8000-000000000001') $$, 'a dealer sees no requests');
select throws_ok($$ select public.approve_waitlist_request((select id from ids where name = 'ishaan')) $$, '42501', null, 'and approves none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select full_name, table_id from public.waitlist_requests('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Ishaan Verma'::text, pg_temp.table_id('Table 2')), ('Mihir Shah', pg_temp.table_id('Table 2')) $$,
  'the floor sees the two requests, oldest first, each with its table');
select is((select count(*)::integer from public.waitlist_board('00000000-0000-4000-8000-000000000001')
           where member_id in ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000213')), 0,
  'and neither is on the list yet, so neither is called');
select lives_ok($$ select public.approve_waitlist_request((select id from ids where name = 'ishaan')) $$, 'the floor approves Ishaan');
select throws_ok($$ select public.approve_waitlist_request((select id from ids where name = 'ishaan')) $$, '22023', null, 'once');
select lives_ok($$ select public.leave_waitlist((select id from ids where name = 'mihir')) $$, 'and removes Mihir''s request');
select results_eq($$ select full_name, place from public.waitlist_board('00000000-0000-4000-8000-000000000001')
                     where asked_table_id = pg_temp.table_id('Table 2') order by place $$,
  $$ values ('Kabir Sethi'::text, 1), ('Naina Kapoor', 2), ('Rohan Bhatia', 3), ('Ishaan Verma', 4) $$,
  'Ishaan is fourth on the list');
select is_empty($$ select * from public.waitlist_requests('00000000-0000-4000-8000-000000000001') $$, 'and no request is left');
select throws_ok($$ select public.approve_waitlist_request((select id from ids where name = 'mihir')) $$, '22023', null,
  'a removed request is approved no more');
select isnt(public.add_to_waitlist(pg_temp.table_id('Table 1'), '9000000212', gen_random_uuid()), null, 'the floor adds Vihaan to Table 1''s list');
select is((select place from public.waitlist_board('00000000-0000-4000-8000-000000000001') where full_name = 'Vihaan Kapoor'), 1,
  'and he is on the list at once');
select throws_ok($$ select public.add_to_waitlist(pg_temp.table_id('Table 1'), '9000000211', gen_random_uuid()) $$, 'RVONE', null,
  'but adds nobody already waiting on another list');
reset role;

select is((select approved_by_staff_id from public.waitlist_entry where id = (select id from ids where name = 'ishaan')),
  (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000103' and s.venue_id = '00000000-0000-4000-8000-000000000001'),
  'the approval keeps who gave it');
select is((select status from public.waitlist_entry where id = (select id from ids where name = 'mihir')), 'left', 'the removed request is left');

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select place, is_request from public.my_waitlist() $$, $$ values (4, false) $$, 'Ishaan sees his place, fourth');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select * from public.my_waitlist() $$, 'and Mihir is on no list');
reset role;

-- A request is called by no one, and a seated member asks for no game from the app.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'mihir request', public.join_waitlist_at(pg_temp.table_id('Table 2'), gen_random_uuid());
reset role;
select throws_ok($$ select private.put_call((select id from ids where name = 'mihir request'),
                    (select g.id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2'), 9) $$,
  '22023', null, 'the floor calls no request to a seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.leave_waitlist((select id from ids where name = 'mihir request')) $$, 'the floor removes it');
select isnt(public.seat_member((select g.id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2'), 3,
  '9000000216'), null, 'and seats Kunal at Table 2');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select throws_ok($$ select public.join_waitlist_at(pg_temp.table_id('Table 1'), gen_random_uuid()) $$, 'RVONE', null,
  'who, seated, asks for no game from the app');
reset role;

-- Mihir asks again; the floor adding him to that table's list approves his request.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'mihir again', public.join_waitlist_at(pg_temp.table_id('Table 2'), gen_random_uuid());
reset role;
select is((select count(*)::integer from public.public_waitlist_length l where l.table_type_code = 'nlh_100_200'), 1, 'the website has the game');
select is((select waiting from public.public_waitlist_length l join public.venue v on v.slug = l.venue_slug
           where l.table_type_code = 'nlh_100_200' and v.id = '00000000-0000-4000-8000-000000000001'), 4,
  'and counts the four on its list, not the request');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.add_to_waitlist(pg_temp.table_id('Table 2'), '9000000213', gen_random_uuid()), (select id from ids where name = 'mihir again'),
  'the floor adding Mihir to the table he asked for keeps his one place');
select is((select place from public.waitlist_board('00000000-0000-4000-8000-000000000001') where full_name = 'Mihir Shah'), 5,
  'and approves it: he is fifth on the list');
reset role;

select is(has_function_privilege('anon', 'public.approve_waitlist_request(uuid)', 'execute'), false, 'nobody signed out approves');
select is(has_function_privilege('anon', 'public.waitlist_requests(uuid)', 'execute'), false, 'nor reads the requests');

select * from finish();
rollback;
