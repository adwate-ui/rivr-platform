-- Joining is a request (#633). A join from the app waits for the floor (waitlist.manage: 103 Aditya), which approves it
-- onto the list, in the order the member asked, or removes it; the floor's own adds are on the list at once. A member waits
-- for one game at a time. Tonight's tables say each game's call time. 211 Ishaan, 212 Vihaan and 213 Mihir have finished
-- their identity check; 106 Pema is a dealer. The seed puts Kabir, Naina and Rohan on 100/200.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.type_id(p_code text) returns uuid language sql as $$
  select id from public.table_type where code = p_code and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
grant execute on function pg_temp.as_person(text), pg_temp.type_id(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

-- Ishaan and Mihir ask to join 100/200 from the app.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'ishaan', public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid());
select results_eq($$ select place, is_request from public.my_waitlist() $$, $$ values (null::integer, true) $$,
  'Ishaan''s join is a request, with no place yet');
select throws_ok($$ select public.join_waitlist(pg_temp.type_id('nlh_50_100'), gen_random_uuid()) $$, 'RVONE', null,
  'and he asks for one game at a time');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'mihir', public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid());
reset role;
-- One transaction gives every row the same time: Ishaan asked a minute before Mihir.
update public.waitlist_entry set joined_at = now() - interval '1 minute' where id = (select id from ids where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select l.waiting, l.call_time_minutes from public.waitlist_lengths() l where l.table_type_id = pg_temp.type_id('nlh_100_200') $$,
  $$ values (3, 180) $$, 'Home counts only the three on the list, and says the game''s three hours of call time');
reset role;

-- The floor sees both, oldest first, on no list until approved; a dealer sees none and approves none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.waitlist_requests('00000000-0000-4000-8000-000000000001') $$, 'a dealer sees no requests');
select throws_ok($$ select public.approve_waitlist_request((select id from ids where name = 'ishaan')) $$, '42501', null, 'and approves none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select full_name from public.waitlist_requests('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Ishaan Verma'::text), ('Mihir Shah') $$, 'the floor sees the two requests, oldest first');
select is((select count(*)::integer from public.waitlist_board('00000000-0000-4000-8000-000000000001')
           where member_id in ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000213')), 0,
  'and neither is on the list yet, so neither is called');
select lives_ok($$ select public.approve_waitlist_request((select id from ids where name = 'ishaan')) $$, 'the floor approves Ishaan');
select throws_ok($$ select public.approve_waitlist_request((select id from ids where name = 'ishaan')) $$, '22023', null, 'once');
select lives_ok($$ select public.leave_waitlist((select id from ids where name = 'mihir')) $$, 'and removes Mihir''s request');
select results_eq($$ select full_name, place from public.waitlist_board('00000000-0000-4000-8000-000000000001')
                     where table_type_id = pg_temp.type_id('nlh_100_200') order by place $$,
  $$ values ('Kabir Sethi'::text, 1), ('Naina Kapoor', 2), ('Rohan Bhatia', 3), ('Ishaan Verma', 4) $$,
  'Ishaan is fourth on the list');
select is_empty($$ select * from public.waitlist_requests('00000000-0000-4000-8000-000000000001') $$, 'and no request is left');
select throws_ok($$ select public.approve_waitlist_request((select id from ids where name = 'mihir')) $$, '22023', null,
  'a removed request is approved no more');
select isnt(public.add_to_waitlist(pg_temp.type_id('nlh_50_100'), '9000000212', gen_random_uuid()), null, 'the floor adds Vihaan to 50/100');
select is((select place from public.waitlist_board('00000000-0000-4000-8000-000000000001') where full_name = 'Vihaan Kapoor'), 1,
  'and he is on the list at once');
select throws_ok($$ select public.add_to_waitlist(pg_temp.type_id('nlh_50_100'), '9000000211', gen_random_uuid()) $$, 'RVONE', null,
  'but adds nobody already waiting for another game');
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
insert into ids select 'mihir request', public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid());
reset role;
select throws_ok($$ select private.put_call((select id from ids where name = 'mihir request'),
                    (select g.id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3'), 9) $$,
  '22023', null, 'the floor calls no request to a seat');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.leave_waitlist((select id from ids where name = 'mihir request')) $$, 'the floor removes it');
select isnt(public.seat_member((select g.id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2'), 3,
  '9000000216'), null, 'and seats Kunal at Table 2');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select throws_ok($$ select public.join_waitlist(pg_temp.type_id('nlh_50_100'), gen_random_uuid()) $$, 'RVONE', null,
  'who, seated, asks for no game from the app');
reset role;

-- Mihir asks again; the floor adding him to that game approves his request.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
insert into ids select 'mihir again', public.join_waitlist(pg_temp.type_id('nlh_100_200'), gen_random_uuid());
reset role;
select is((select count(*)::integer from public.public_waitlist_length l where l.table_type_code = 'nlh_100_200'), 1, 'the website has the game');
select is((select waiting from public.public_waitlist_length l join public.venue v on v.slug = l.venue_slug
           where l.table_type_code = 'nlh_100_200' and v.id = '00000000-0000-4000-8000-000000000001'), 4,
  'and counts the four on its list, not the request');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.add_to_waitlist(pg_temp.type_id('nlh_100_200'), '9000000213', gen_random_uuid()), (select id from ids where name = 'mihir again'),
  'the floor adding Mihir to the game he asked for keeps his one place');
select is((select place from public.waitlist_board('00000000-0000-4000-8000-000000000001') where full_name = 'Mihir Shah'), 5,
  'and approves it: he is fifth on the list');
reset role;

select is(has_function_privilege('anon', 'public.approve_waitlist_request(uuid)', 'execute'), false, 'nobody signed out approves');
select is(has_function_privilege('anon', 'public.waitlist_requests(uuid)', 'execute'), false, 'nor reads the requests');

select * from finish();
rollback;
