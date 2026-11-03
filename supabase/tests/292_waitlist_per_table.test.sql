-- One waitlist per table (owner, #777; decision 0433). The seed puts Kabir (202), Naina (203) and Rohan (204) on Table 2's
-- list; Tables 2, 3 and 5 are open at 100/200. Ishaan (211), Vihaan (212) and Mihir (213) have finished the check; 103
-- Aditya is the floor; 101 Vikram sets up tables. Each table's list has its own order, its own calls and its own count;
-- the website's count stays one a stake.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- This test's club night began twelve hours before it (#716), as in 029.
create temp table night_shift on commit drop as select now() - private.tonight_began(now()) - interval '12 hours' as shift;
grant select on night_shift to authenticated, anon, service_role;
create or replace function private.tonight_began(p_at timestamptz) returns timestamptz language sql stable set search_path = '' as $$
  select ((date_trunc('day', ((p_at - s.shift) at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata')
         + s.shift
  from pg_temp.night_shift s;
$$;

create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', m, f, true, 'test 292'
from unnest(array['00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000213']::uuid[]) m
cross join unnest(array['waitlist.join', 'floor.live_view', 'push.seat_ready']) f
on conflict do nothing;

-- A waiting place is on a table's list, always; the seed's are on Table 2's.
select throws_ok($$ insert into public.waitlist_entry (venue_id, member_id, table_type_id, idempotency_key)
                    select g.venue_id, '00000000-0000-4000-8000-000000000213', g.table_type_id, gen_random_uuid() from public.game_table g
                    where g.id = pg_temp.table_id('Table 3') $$,
  '23514', null, 'a waiting place without a table is refused');
select is_empty($$ select 1 from public.waitlist_entry where status = 'waiting' and table_id is null $$, 'every waiting place has its table');
select results_eq($$ select g.name, count(*)::integer from public.waitlist_entry e join public.game_table g on g.id = e.table_id
                     where e.status = 'waiting' and e.venue_id = '00000000-0000-4000-8000-000000000001' group by g.name $$,
  $$ values ('Table 2'::text, 3) $$, 'the seed''s three wait on Table 2''s list');
select ok((select bool_and(s.row_data ->> 'table_id' is not null) from private.practice_seed s
           where s.table_name = 'waitlist_entry' and s.row_data ->> 'status' = 'waiting'),
  'and the practice venue''s seed keeps its places on their table, so a reset passes the check');

-- Ishaan joins Table 3's list from the app; the floor adds Mihir to it. Table 3 has a list of its own, numbered from 1.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
insert into ids select 'ishaan', public.join_waitlist_at(pg_temp.table_id('Table 3'), '00000000-0000-4000-8000-00000000a292');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.approve_waitlist_request((select id from ids where name = 'ishaan')) $$, 'the floor approves Ishaan onto Table 3''s list');
insert into ids select 'mihir', public.add_to_waitlist(pg_temp.table_id('Table 3'), '9000000213', gen_random_uuid());
reset role;
update public.waitlist_entry set joined_at = now() - interval '2 minutes' where id = (select id from ids where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select g.name, b.full_name, b.place from public.waitlist_board('00000000-0000-4000-8000-000000000001') b
                     join public.game_table g on g.id = b.asked_table_id order by g.position, b.place $$,
  $$ values ('Table 2'::text, 'Kabir Sethi'::text, 1), ('Table 2', 'Naina Kapoor', 2), ('Table 2', 'Rohan Bhatia', 3),
            ('Table 3', 'Ishaan Verma', 1), ('Table 3', 'Mihir Shah', 2) $$,
  'each table''s list is numbered on its own, at the same stake');
select results_eq($$ select g.name, l.waiting from public.waitlist_lengths() l join public.game_table g on g.id = l.table_id
                     where g.name in ('Table 2', 'Table 3', 'Table 5') and g.venue_id = '00000000-0000-4000-8000-000000000001' order by g.position $$,
  $$ values ('Table 2'::text, 3), ('Table 3', 2), ('Table 5', 0) $$, 'and counted on its own');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select table_name, place from public.my_waitlist() $$, $$ values ('Table 3'::text, 1) $$, 'Ishaan is first on Table 3''s list');
reset role;
select results_eq($$ select table_name, place from private.live_status_of('00000000-0000-4000-8000-000000000211') $$,
  $$ values ('Table 3'::text, 1) $$, 'and his phone''s live status says so');
select is((select waiting from public.public_waitlist_length l join public.venue v on v.slug = l.venue_slug
           where l.table_type_code = 'nlh_100_200' and v.id = '00000000-0000-4000-8000-000000000001'), 5,
  'the website still counts the stake''s five, never a table''s');
select results_eq($$ select x ->> 'table', (x ->> 'place')::integer, x ->> 'name'
                     from jsonb_array_elements(private.offline_pack('00000000-0000-4000-8000-000000000001') -> 'waitlist') x $$,
  $$ values ('Table 2'::text, 1, 'Kabir Sethi'::text), ('Table 2', 2, 'Naina Kapoor'), ('Table 2', 3, 'Rohan Bhatia'),
            ('Table 3', 1, 'Ishaan Verma'), ('Table 3', 2, 'Mihir Shah') $$, 'the offline pack names each place''s table');

-- One list at a time; the floor switches a member by removing and adding.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_to_waitlist(pg_temp.table_id('Table 2'), '9000000211', gen_random_uuid()) $$, 'RVONE', null,
  'a member on Table 3''s list is added to no other');
select throws_ok($$ select public.add_to_waitlist(pg_temp.table_id('Table 2'), '9000000211', '00000000-0000-4000-8000-00000000a292') $$, '22023', null,
  'and a request id replays only its own table''s place');

-- Calls go to the list's own table, and roll on only along it.
select throws_ok($$ select public.call_from_waitlist((select id from ids where name = 'ishaan'), pg_temp.table_id('Table 2'), 4) $$, '22023', null,
  'nobody is called to another table''s seat');
select lives_ok($$ select public.call_from_waitlist((select id from ids where name = 'ishaan'), pg_temp.table_id('Table 3'), 4) $$,
  'Ishaan is called to Table 3, seat 4');
reset role;
-- Kabir, first on Table 2's list, is called to its seat 1 and leaves: the call rolls on along Table 2's list only, where
-- nobody else has finished the check, so nobody on Table 3's is called to Table 2.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'verified', 'digilocker', '1990-01-01', 'ABCPK2022K',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/selfie.jpg', now())
on conflict (member_id) do update set status = 'verified', verified_at = now();
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.call_from_waitlist(e.id, pg_temp.table_id('Table 2'), 1) from public.waitlist_entry e
                   where e.member_id = '00000000-0000-4000-8000-000000000202' and e.status = 'waiting' $$, 'Kabir is called to Table 2, seat 1');
select lives_ok($$ select public.leave_waitlist(e.id) from public.waitlist_entry e
                   where e.member_id = '00000000-0000-4000-8000-000000000202' and e.status = 'waiting' $$, 'and leaves');
reset role;
select is((select call_table_id from public.waitlist_entry where id = (select id from ids where name = 'mihir')), null,
  'Mihir, next on Table 3''s list, is not called to Table 2');

-- A table's stake stays while its list has places.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select public.set_game_table(pg_temp.table_id('Table 3'), 'Table 3',
                      (select id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'nlh_50_100'), 9) $$,
  'RVSTD', null, 'Table 3''s stake stays while its list has places');
reset role;

-- The floor adds by membership number as well as by mobile (console v3: "Add: mobile or member no."), one of the two.
create temp table vihaan as select member_number from public.member where id = '00000000-0000-4000-8000-000000000212';
grant select on vihaan to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.add_to_waitlist(pg_temp.table_id('Table 5'), null, gen_random_uuid()) $$, '22023', null,
  'neither a mobile nor a membership number adds nobody');
select throws_ok($$ select public.add_to_waitlist(pg_temp.table_id('Table 5'), '9000000212', gen_random_uuid(), (select member_number from vihaan)) $$,
  '22023', null, 'nor both at once');
select throws_ok($$ select public.add_to_waitlist(pg_temp.table_id('Table 5'), null, gen_random_uuid(), 999999999) $$, 'RVNOM', null,
  'a membership number nobody has adds nobody');
insert into ids select 'vihaan', public.add_to_waitlist(pg_temp.table_id('Table 5'), null, gen_random_uuid(), (select member_number from vihaan));
reset role;
select is((select g.name from public.waitlist_entry e join public.game_table g on g.id = e.table_id join ids on ids.id = e.id where ids.name = 'vihaan'),
  'Table 5', 'Vihaan, found by his membership number, goes on Table 5''s list');

-- The old join for a stake is gone.
select is(to_regprocedure('public.join_waitlist(uuid, uuid)'), null, 'there is no join for a stake');

select * from finish();
rollback;
