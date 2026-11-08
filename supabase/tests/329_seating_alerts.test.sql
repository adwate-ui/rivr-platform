-- Seating an approved player is a task for the floor (the owner, 8 Nov). The seed's three wait on Table 2's list; Kabir
-- and Naina have finished their identity check, Rohan has not. With seats free, Kabir and Naina are ready to seat and
-- counted, Rohan needs his check first. Table 2 then has two seats and one taken: one free seat is the turn of the first
-- of them on the list, and the other waits. Kabir is called to seat 2, held for him: he is still ready there. Seated, he
-- is no longer a task. A place approved last night is none of tonight's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table t2 as select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2';
create temp table waiting as select e.id as entry_id, m.id as member_id, m.full_name from public.waitlist_entry e join public.member m on m.id = e.member_id
  where e.venue_id = '00000000-0000-4000-8000-000000000001' and e.status = 'waiting';
grant select on t2, waiting to authenticated;

-- Kabir's and Naina's identity checks are finished.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', w.member_id, 'verified', 'digilocker', '1990-01-01',
       case w.full_name when 'Kabir Sethi' then 'ABCPK1234A' else 'ABCPN1235B' end,
       '00000000-0000-4000-8000-000000000001/' || w.member_id || '/selfie.jpg', now()
from waiting w where w.full_name in ('Kabir Sethi', 'Naina Kapoor')
on conflict (member_id) do update set status = excluded.status, method = excluded.method, date_of_birth = excluded.date_of_birth,
  pan = excluded.pan, photo_path = excluded.photo_path, verified_at = excluded.verified_at;

-- Of the two, who is first on Table 2's list, and who second, as the list orders them.
create temp table turn as
  select w.full_name, row_number() over (order by r.place) as n
  from private.ranked_waitlist((select array_agg(id) from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001')) r
  join waiting w on w.entry_id = r.entry_id where w.full_name in ('Kabir Sethi', 'Naina Kapoor');
grant select on turn to authenticated;

create function pg_temp.alerts() returns table (kind text, full_name text, seat integer) language sql as $$
  select r.kind, r.full_name, r.seat from public.floor_requests('00000000-0000-4000-8000-000000000001') r
  where r.kind in ('seat', 'seat_check', 'seat_wait') and r.table_id = (select id from t2) order by r.full_name;
$$;
create function pg_temp.seating() returns integer language sql as $$
  select coalesce((select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'seating'), 0);
$$;
grant execute on function pg_temp.alerts(), pg_temp.seating() to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from pg_temp.alerts() $$,
  $$ values ('seat'::text, 'Kabir Sethi'::text, null::integer), ('seat', 'Naina Kapoor', null), ('seat_check', 'Rohan Bhatia', null) $$,
  'with seats free, the checked are ready to seat, and Rohan needs his identity check first');
select is(pg_temp.seating(), 2, 'the Live floor counts the two ready');
reset role;

-- Table 2 shrinks to two seats, and a member sits in seat 1: one seat free.
update public.game_table set seats = 2 where id = (select id from t2);
insert into public.visit (id, venue_id, member_id, opened_at)
values ('00000000-0000-4000-8000-0000000c3291', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', now() - interval '1 hour');
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-0000000c3291', id, 1,
       now() - interval '50 minutes', now() - interval '50 minutes' from t2;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select kind, full_name from pg_temp.alerts() where kind <> 'seat_check' order by kind, full_name $$,
  $$ select 'seat'::text, (select full_name from turn where n = 1) union all select 'seat_wait', (select full_name from turn where n = 2) $$,
  'one seat free: the first of them on the list is ready, the next waits');
select is(pg_temp.seating(), 1, 'and only one counts');

select lives_ok($$ select public.call_from_waitlist((select entry_id from waiting where full_name = 'Kabir Sethi'), (select id from t2), 2) $$,
  'the floor calls Kabir to seat 2');
select results_eq($$ select * from pg_temp.alerts() $$,
  $$ values ('seat'::text, 'Kabir Sethi'::text, 2), ('seat_wait', 'Naina Kapoor', null), ('seat_check', 'Rohan Bhatia', null) $$,
  'Table 2 full: Kabir is still ready at the seat held for him, Naina waits for a seat');
select ok((select since from public.floor_requests('00000000-0000-4000-8000-000000000001') where kind = 'seat' and full_name = 'Kabir Sethi')
          = (select called_at from public.waitlist_entry where id = (select entry_id from waiting where full_name = 'Kabir Sethi')),
  'his wait to be seated counts from his call');

select lives_ok($$ select public.seat_from_waitlist((select entry_id from waiting where full_name = 'Kabir Sethi')) $$, 'the floor seats Kabir');
select is_empty($$ select 1 from pg_temp.alerts() where full_name = 'Kabir Sethi' $$, 'seated, he is no longer a task');
select is(pg_temp.seating(), 0, 'and nothing is counted while the table is full');
reset role;

-- A place approved on last night's list is none of tonight's alerts.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, joined_at, approved_at)
select g.venue_id, '00000000-0000-4000-8000-000000000215', g.table_type_id, g.id, gen_random_uuid(),
       private.tonight_began(now()) - interval '2 hours', private.tonight_began(now()) - interval '2 hours'
from public.game_table g where g.id = (select id from t2);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.floor_requests('00000000-0000-4000-8000-000000000001')
                   where kind in ('seat', 'seat_check', 'seat_wait') and member_id = '00000000-0000-4000-8000-000000000215' $$,
  'last night''s approved place is no alert tonight');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select * from public.floor_requests('00000000-0000-4000-8000-000000000001') $$, '42501', null,
  'a dealer reads no floor requests');
reset role;

select * from finish();
rollback;
