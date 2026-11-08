-- The floor's one-tap Call (audit F-166; the owner, 8 Nov): the first free seat at the list's table held for the member, who
-- is told. 108 Karan is a host; 106 a dealer, who calls nobody.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true), set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(uuid) to authenticated;

-- A small open table, its list six members long.
insert into public.game_table (venue_id, name, is_open, seats, position, table_type_id, room)
select venue_id, 'Call test', true, 2, 99, table_type_id, room from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
create temp table entries as
  select m.n, (select id from public.game_table where name = 'Call test') as table_id, gen_random_uuid() as id,
         ('00000000-0000-4000-8000-000000000' || m.member)::uuid as member_id
  from (values (1, '211'), (2, '212'), (3, '213'), (4, '214'), (5, '215'), (6, '216')) m (n, member);
grant select on entries to authenticated;
insert into public.waitlist_entry (id, venue_id, member_id, table_type_id, table_id, joined_at, approved_at, status, idempotency_key)
select e.id, g.venue_id, e.member_id, g.table_type_id, g.id, now() - (e.n || ' minutes')::interval, now(), 'waiting', gen_random_uuid()
from entries e join public.game_table g on g.id = e.table_id;

create function pg_temp.entry(p_n integer) returns uuid language sql as $$ select id from entries where n = p_n; $$;
grant execute on function pg_temp.entry(integer) to authenticated;
create function pg_temp.told(p_n integer) returns integer language sql as $$
  select count(*)::integer from public.outbox_event o where o.event_type = 'waitlist.called' and o.payload ->> 'entry_id' = pg_temp.entry(p_n)::text;
$$;

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.call_to_seat(pg_temp.entry(1)) $$, '42501', null, 'a dealer calls nobody');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is(public.call_to_seat(pg_temp.entry(1)), 1, 'Call holds the first free seat at the list''s table');
reset role;
select is(pg_temp.told(1), 1, 'and the member is told, once');
select ok((select hold_until > now() and call_seat = 1 from public.waitlist_entry where id = pg_temp.entry(1)), 'and the seat is held for them');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.call_to_seat(pg_temp.entry(1)) $$, '22023', null, 'a member already called is not called again');
select is(public.call_to_seat(pg_temp.entry(2)), 2, 'the next call takes the next seat, not the one held');
select throws_ok($$ select public.call_to_seat(pg_temp.entry(3)) $$, 'RVOCC', null, 'with every seat held there is nothing to call anyone to');
reset role;
select is(pg_temp.told(3), 0, 'and nobody is told');

select ok(not has_function_privilege('authenticated', 'private.put_call(uuid, uuid, integer, boolean)', 'execute'), 'only these functions place a call');

-- A member calls nobody, themselves included.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.call_to_seat(pg_temp.entry(3)) $$, '42501', null, 'a member calls nobody, themselves included');
reset role;

-- A hold that runs out frees the seat and calls nobody, and the next call takes it.
update public.waitlist_entry set hold_until = now() - interval '1 second' where id = pg_temp.entry(1);
select private.expire_waitlist_holds();
select is((select called_at from public.waitlist_entry where id = pg_temp.entry(3)), null, 'a hold that runs out calls nobody');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is(public.call_to_seat(pg_temp.entry(3)), 1, 'and the seat is there for the floor''s next Call');
reset role;

-- A member called is seated in the seat held for them, with the call time chosen then, and no second message.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.assign_from_waitlist(pg_temp.entry(2), (select table_id from entries limit 1), 2, 240) $$, 'the floor seats a called member in the seat held for them');
reset role;
select is((select s.call_time_minutes from public.seat_session s where s.member_id = (select member_id from entries where n = 2) and s.ended_at is null), 240, 'with the call time chosen');
select is(pg_temp.told(2), 1, 'and only the call told them');

-- Staff never call themselves; and five calls an hour at most tell one member.
update public.game_table set seats = 9 where name = 'Call test';
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is(public.call_to_seat(pg_temp.entry(4)), 3, 'a third seat for the next on the list');
reset role;
update public.member set user_id = '00000000-0000-4000-8000-000000000108' where id = (select member_id from entries where n = 5);
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok($$ select public.call_to_seat(pg_temp.entry(5)) $$, 'RVOWN', null, 'staff never call their own member record');
reset role;
insert into public.outbox_event (venue_id, event_type, payload, idempotency_key)
select e.venue_id, 'waitlist.called', jsonb_build_object('member_id', e.member_id, 'entry_id', 'earlier'), 'test:' || n
from public.waitlist_entry e cross join generate_series(1, 5) n where e.id = pg_temp.entry(6);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.call_to_seat(pg_temp.entry(6)), 4, 'past five calls in an hour the seat is still held');
reset role;
select is(pg_temp.told(6), 0, 'but the member is not told again');

select * from finish();
rollback;
