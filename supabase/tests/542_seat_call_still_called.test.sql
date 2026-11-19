-- A seat call is told only while it stands (#864). The call carries the moment it was made; the senders ask
-- seat_call_in_force at send time, so a call skipped or seated in the minute before the outbox claims it sends nothing.
-- 108 Karan is a host.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true), set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(uuid) to authenticated;

-- A small open table, its list three members long.
insert into public.game_table (venue_id, name, is_open, seats, position, table_type_id, room, min_buy_in_paise)
select venue_id, 'Call test', true, 3, 99, table_type_id, room, min_buy_in_paise from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3';
create temp table entries as
  select m.n, (select id from public.game_table where name = 'Call test') as table_id, gen_random_uuid() as id,
         ('00000000-0000-4000-8000-000000000' || m.member)::uuid as member_id
  from (values (1, '211'), (2, '212'), (3, '213')) m (n, member);
grant select on entries to authenticated;
insert into public.waitlist_entry (id, venue_id, member_id, table_type_id, table_id, joined_at, approved_at, status, idempotency_key)
select e.id, g.venue_id, e.member_id, g.table_type_id, g.id, now() - (e.n || ' minutes')::interval, now(), 'waiting', gen_random_uuid()
from entries e join public.game_table g on g.id = e.table_id;
create function pg_temp.entry(p_n integer) returns uuid language sql as $$ select id from entries where n = p_n; $$;
grant execute on function pg_temp.entry(integer) to authenticated;
-- The moment the call for a place says it was made, and whether the senders would tell of it now.
create function pg_temp.said(p_n integer) returns timestamptz language sql as $$
  select (o.payload ->> 'called_at')::timestamptz from public.outbox_event o
  where o.event_type = 'waitlist.called' and o.payload ->> 'entry_id' = pg_temp.entry(p_n)::text order by o.created_at desc limit 1;
$$;
create function pg_temp.stands(p_n integer) returns boolean language sql as $$
  select public.seat_call_in_force('00000000-0000-4000-8000-000000000001', pg_temp.entry(p_n), pg_temp.said(p_n));
$$;

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is(public.call_to_seat(pg_temp.entry(1)), 1, 'Karan calls Ishaan');
select is(public.call_to_seat(pg_temp.entry(2)), 2, 'and Vihaan');
select is(public.call_to_seat(pg_temp.entry(3)), 3, 'and Mihir');
reset role;
select is(pg_temp.said(1), (select called_at from public.waitlist_entry where id = pg_temp.entry(1)), 'the call says when it was made');
select ok(pg_temp.stands(1), 'a call just made stands');
select ok(not public.seat_call_in_force('00000000-0000-4000-8000-000000000002', pg_temp.entry(1), pg_temp.said(1)), 'not for another venue');
select ok(not public.seat_call_in_force('00000000-0000-4000-8000-000000000001', pg_temp.entry(1), pg_temp.said(1) - interval '1 minute'),
  'nor for an earlier call of the same place');

-- Within the minute: Ishaan is skipped, Vihaan is seated, and Mihir's hold runs out.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select lives_ok($$ select public.step_away(pg_temp.entry(1), true) $$, 'Karan skips Ishaan');
select lives_ok($$ select public.seat_from_waitlist(pg_temp.entry(2)) $$, 'and seats Vihaan');
reset role;
update public.waitlist_entry set hold_until = now() - interval '1 second' where id = pg_temp.entry(3);
select results_eq($$ select pg_temp.stands(1), pg_temp.stands(2), pg_temp.stands(3) $$, $$ values (false, false, false) $$,
  'a call skipped, seated or run out no longer stands, so nothing is sent');

select ok(has_function_privilege('service_role', 'public.seat_call_in_force(uuid, uuid, timestamptz)', 'execute'), 'the senders ask it');
select ok(not has_function_privilege('authenticated', 'public.seat_call_in_force(uuid, uuid, timestamptz)', 'execute')
          and not has_function_privilege('anon', 'public.seat_call_in_force(uuid, uuid, timestamptz)', 'execute'), 'nobody signed in does');

select * from finish();
rollback;
