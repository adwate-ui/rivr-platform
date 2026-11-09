-- A ticket knows whether its guest is still in the seat (audit F-085): seated, asked to leave, or gone. Kabir (202) orders at
-- Table 4, seat 9; 103 Aditya runs the floor and serves.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.state() returns text language sql as $$
  select seat_state from public.fnb_orders_tonight('00000000-0000-4000-8000-000000000001') where kot_number = 9394;
$$;
grant execute on function pg_temp.state() to authenticated;

-- The seat, cleared of anyone the seed has there.
update public.seat_session s set ended_at = now(), end_reason = 'left'
from public.game_table g
where g.id = s.table_id and g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 4' and s.seat = 9 and s.ended_at is null;

insert into public.visit (venue_id, member_id)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202'
where not exists (select 1 from public.visit where member_id = '00000000-0000-4000-8000-000000000202' and closed_at is null);
insert into public.seat_session (id, venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-0000000f3940', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202',
       (select id from public.visit where member_id = '00000000-0000-4000-8000-000000000202' order by opened_at desc limit 1), g.id, 9, now(), now()
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 4';
insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, lines, source, kot_number, idempotency_key)
select '00000000-0000-4000-8000-000000000001',
       (select id from public.visit where member_id = '00000000-0000-4000-8000-000000000202' order by opened_at desc limit 1),
       '00000000-0000-4000-8000-000000000202', g.id, 9, private.club_day_now(),
       '[{"item_id": "00000000-0000-4000-8000-000000000999", "name": "Masala chai", "kind": "soft_drink", "quantity": 1, "note": null}]'::jsonb,
       'app', 9394, '00000000-0000-4000-8000-00000000f394'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 4';

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.state(), 'seated', 'a guest in the seat is seated');
reset role;

-- A move updates the session; the order stays where it was placed.
update public.seat_session s set seat = 8
where s.id = '00000000-0000-4000-8000-0000000f3940'
  and not exists (select 1 from public.seat_session o where o.table_id = s.table_id and o.seat = 8 and o.ended_at is null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.state(), 'seated', 'a guest moved to another seat is still seated');
reset role;

update public.seat_session set leaving_at = now() where id = '00000000-0000-4000-8000-0000000f3940';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.state(), 'leaving', 'one who has asked to go is leaving');
reset role;

update public.seat_session set ended_at = now(), end_reason = 'left' where id = '00000000-0000-4000-8000-0000000f3940';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.state(), 'left', 'one whose seat has ended has left');
reset role;

-- Someone else at that seat afterwards does not bring the first guest back.
insert into public.visit (venue_id, member_id)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203'
where not exists (select 1 from public.visit where member_id = '00000000-0000-4000-8000-000000000203' and closed_at is null);
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203',
       (select id from public.visit where member_id = '00000000-0000-4000-8000-000000000203' order by opened_at desc limit 1), g.id, 9, now(), now()
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 4';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.state(), 'left', 'another guest in the seat is not the one it goes to');
reset role;

select * from finish();
rollback;
