-- Players never see how many are seated, how many wait or how many seats are open (the owner, 8 Nov and 15 Nov;
-- redesign RD-20): the two reads the player's Home makes carry no count to a member, and the website's tables none to
-- anyone. 211 Ishaan is a member with the live floor; 103 Aditya is the floor's admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Someone waits on Table 2's list and someone sits at Table 5, so there are counts to hide.
create temp table spot as
  select (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2') as waited,
         (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5') as played;
grant select on spot to authenticated;
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, joined_at, approved_at, status, idempotency_key)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', g.table_type_id, g.id, now(), now(), 'waiting', gen_random_uuid()
from public.game_table g where g.id = (select waited from spot)
  and not exists (select 1 from public.waitlist_entry e where e.member_id = '00000000-0000-4000-8000-000000000201' and e.status = 'waiting');
insert into public.visit (venue_id, member_id)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213'
where not exists (select 1 from public.visit v where v.member_id = '00000000-0000-4000-8000-000000000213' and v.closed_at is null);
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213',
       (select v.id from public.visit v where v.member_id = '00000000-0000-4000-8000-000000000213' and v.closed_at is null), (select played from spot), 9
where not exists (select 1 from public.seat_session s where s.member_id = '00000000-0000-4000-8000-000000000213' and s.ended_at is null);

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select l.waiting >= 1 from public.waitlist_lengths() l where l.table_id = (select waited from spot)), 'the floor reads how many wait on a table''s list');
select ok((select o.open_seats < g.seats from public.floor_open_seats() o join public.game_table g on g.id = o.table_id where o.table_id = (select played from spot)),
  'and how many seats are open at a table');

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.waitlist_lengths() l where l.waiting is not null), 0, 'a member is told no count of who waits, at any table');
select ok((select count(*) = 6 and bool_and(l.call_time_minutes > 0) from public.waitlist_lengths() l),
  'though each of the club''s six tables still comes with its call time, which the join sheet shows');
select is_empty($$ select * from public.floor_open_seats() $$, 'nor any count of open seats');
select is_empty($$ select * from public.floor_taken_seats() $$, 'nor which seats are taken, with someone seated at Table 5');
select ok((select count(*) >= 5 from public.game_table), 'while the tables themselves, their stakes and minimum buy-ins, are theirs to read');

-- The website's and the link-in-bio's tables: no count of seats taken, to anyone.
reset role;
select set_config('request.jwt.claims', '', true);
select is((select count(*)::integer from public.public_table_status where seats_taken is not null), 0, 'the public table status carries no count of seats taken');
set local role anon;
select is((select count(*)::integer from public.public_table_status where seats_taken is not null), 0, 'nor to someone signed out');
reset role;
-- Nor how many wait for each game, which anyone could read until 20261120500200.
select hasnt_view('public', 'public_waitlist_length', 'no view counts who waits for each game');
select hasnt_function('private', 'public_waitlist_length_rows', 'nor are its rows read');
select is_empty($$ select c.table_name from information_schema.columns c
                   where c.table_schema = 'public' and c.column_name in ('waiting', 'open_seats', 'seats_open')
                     and has_table_privilege('anon', format('%I.%I', c.table_schema, c.table_name), 'select') $$,
  'and nothing someone signed out may read has a count of who waits or of open seats');

select * from finish();
rollback;
