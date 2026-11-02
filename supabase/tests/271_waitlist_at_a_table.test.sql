-- Joining at a table (decision 0321): the place keeps the table asked for, the list stays the stake's; the floor's board
-- shows it. A called member says they are on their way, once, and only while the seat is held. Ishaan (211) has finished
-- the check; 103 Aditya is the floor. Tables 2, 3 and 5 are open at 100/200.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text) to authenticated;

-- Waitlists from the app need the feature; give Ishaan and Vihaan it whatever their tier says.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', m, 'waitlist.join', true, 'test 271'
from unnest(array['00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000212']::uuid[]) m
on conflict do nothing;
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'verified', 'digilocker', '1990-01-01', 'ABCPV2122V',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000212/selfie.jpg', now())
on conflict do nothing;

-- Ishaan joins at Table 3: on the 100/200 list, the place naming Table 3.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
create temp table ishaan on commit drop as select public.join_waitlist_at(pg_temp.table_id('Table 3'), '00000000-0000-4000-8000-00000000a271'::uuid) as id;
grant select on ishaan to authenticated;
select results_eq($$ select table_id, table_name from public.my_waitlist() $$, $$ values (pg_temp.table_id('Table 3'), 'Table 3'::text) $$,
  'his place names Table 3');
select is(public.join_waitlist_at(pg_temp.table_id('Table 3'), '00000000-0000-4000-8000-00000000a271'::uuid), (select id from ishaan),
  'the same request id joins once');
reset role;
select is((select e.table_type_id from public.waitlist_entry e where e.id = (select id from ishaan)),
  (select g.table_type_id from public.game_table g where g.id = pg_temp.table_id('Table 3')), 'the list is the stake''s');

-- A table of another venue is no table to join at.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.join_waitlist_at((select id from public.game_table where venue_id <> '00000000-0000-4000-8000-000000000001' limit 1),
                     gen_random_uuid()) $$, '22023', null, 'another venue''s table is refused');
reset role;

-- On my way: not before the seat is called.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.accept_seat_call((select id from ishaan)) $$, '22023', null, 'nothing is held for him yet');
reset role;

-- The floor approves the request and calls him to Table 3, seat 4; the board shows the table he asked for.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.approve_waitlist_request((select id from ishaan)) $$, 'the floor approves his request');
select lives_ok($$ select public.call_from_waitlist((select id from ishaan), pg_temp.table_id('Table 3'), 4) $$, 'and calls him to Table 3, seat 4');
select is((select asked_table_id from public.waitlist_board('00000000-0000-4000-8000-000000000001') where entry_id = (select id from ishaan)),
  pg_temp.table_id('Table 3'), 'the floor''s board shows the table he asked for');
reset role;

-- Vihaan may not say Ishaan is on his way; Ishaan may, once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.accept_seat_call((select id from ishaan)) $$, '42501', null, 'another member may not answer his call');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select lives_ok($$ select public.accept_seat_call((select id from ishaan)) $$, 'Ishaan is on his way');
create temp table first_way on commit drop as select on_way_at from public.my_waitlist();
grant select on first_way to authenticated;
select lives_ok($$ select public.accept_seat_call((select id from ishaan)) $$, 'saying it again does no harm');
select is((select on_way_at from public.my_waitlist()), (select on_way_at from first_way), 'and keeps the first time');
reset role;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select on_way_at is not null from public.waitlist_board('00000000-0000-4000-8000-000000000001') where entry_id = (select id from ishaan)),
  'the floor sees he is on his way');
reset role;

-- Called again after he answered (the floor skipped and called him again), his earlier answer does not count for this call.
update public.waitlist_entry set on_way_at = now() - interval '1 minute', called_at = now() - interval '30 seconds' where id = (select id from ishaan);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select on_way_at from public.my_waitlist()), null, 'called again, his earlier answer does not count');
select lives_ok($$ select public.accept_seat_call((select id from ishaan)) $$, 'he answers this call');
select ok((select on_way_at is not null from public.my_waitlist()), 'and the answer shows');
reset role;

-- Past the hold, there is nothing to answer.
update public.waitlist_entry set hold_until = now() - interval '1 minute', on_way_at = null where id = (select id from ishaan);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.accept_seat_call((select id from ishaan)) $$, '22023', null, 'a lapsed hold is not answered');
reset role;

select * from finish();
rollback;
