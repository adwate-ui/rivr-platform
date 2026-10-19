-- A final cash-out closes the visit (#76). Neel Bose (217) has finished his identity check (seed); a
-- floor manager (103) seats him at Table 2, which checks him in. 104 is a cashier; 106 a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'session', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'),
  7, '9000000217');
reset role;
insert into ids select 'visit', private.current_visit('00000000-0000-4000-8000-000000000217');
select isnt((select id from ids where name = 'visit'), null, 'seating Neel opened his visit');

-- A cash-out that is not final leaves him at the table and in the room.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select to_member_paise, is_visit_closed from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 1000000, 'cash', gen_random_uuid()) $$, $$ values (1000000::bigint, false) $$,
  'a cash-out that is not final keeps the visit open');
reset role;
select is(private.current_visit('00000000-0000-4000-8000-000000000217'), (select id from ids where name = 'visit'), 'he is still in the room');
select is((select ended_at from public.seat_session where member_id = '00000000-0000-4000-8000-000000000217'), null, 'and in his seat');

-- The final cash-out: his seat ends and his visit closes.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 1000000, 'cash',
  gen_random_uuid(), true) $$, '42501', null, 'a dealer closes no one''s visit');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select to_member_paise, is_visit_closed from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 2000000, 'wallet', '00000000-0000-4000-8000-0000000c7601', true) $$, $$ values (2000000::bigint, true) $$,
  'a final cash-out closes the visit');
select results_eq($$ select is_visit_closed from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 2000000, 'wallet', '00000000-0000-4000-8000-0000000c7601', true) $$, $$ values (true) $$,
  'a retried tap says the same');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 1000000, 'cash',
  gen_random_uuid()) $$, 'RVOUT', null, 'once he has left there is nothing more to cash out');
reset role;
select results_eq($$ select end_reason, ended_at is not null from public.seat_session where id = (select id from ids where name = 'session') $$,
  $$ values ('cash_out'::text, true) $$, 'his seat ended with the cash-out');
select results_eq($$ select close_reason, closed_at is not null from public.visit where id = (select id from ids where name = 'visit') $$,
  $$ values ('cash_out'::text, true) $$, 'and his visit closed with it');
select is((select count(*)::integer from public.outbox_event where event_type = 'visit.closed'
           and payload ->> 'visit_id' = (select id::text from ids where name = 'visit')), 1, 'visit.closed once, retry or not');
select is((select (payload ->> 'is_final')::boolean from public.outbox_event where event_type = 'cage.cash_out'
           and payload ->> 'cage_transaction_id' = (select c.id::text from public.cage_transaction c
                                                    where c.idempotency_key = '00000000-0000-4000-8000-0000000c7601')), true,
  'cage.cash_out says it was final');
select is((select payload ->> 'reason' from public.outbox_event where event_type = 'seat.left'
           and payload ->> 'session_id' = (select id::text from ids where name = 'session')), 'cash_out', 'and seat.left, for the table');
select is(private.close_visit('00000000-0000-4000-8000-000000000217', now(), 'door'), null, 'closing a visit already closed does nothing');
select is((select count(*)::integer from public.visit where member_id = '00000000-0000-4000-8000-000000000217' and closed_at is null), 0,
  'and he has no open visit');
select is((select is_final from public.cage_transaction where idempotency_key = '00000000-0000-4000-8000-0000000c7601'), true,
  'the cage transaction keeps that it was final');

-- He comes back and sits again: a late retry of the final tap moves nothing and closes nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'again', public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'),
  7, '9000000217');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select to_member_paise, is_visit_closed from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 2000000, 'wallet', '00000000-0000-4000-8000-0000000c7601', true) $$, $$ values (2000000::bigint, false) $$,
  'a late retry gives the same cash-out and leaves the new visit open');
reset role;
select is((select ended_at from public.seat_session where id = (select id from ids where name = 'again')), null, 'and his new seat');

-- A request id is for one kind of cash-out: one not final is not made final by a retry.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select is_visit_closed from public.cage_cash_out('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000217', 1000000, 'cash', '00000000-0000-4000-8000-0000000c7602') $$, $$ values (false) $$, 'a cash-out, not final');
select throws_ok($$ select public.cage_cash_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000217', 1000000, 'cash',
  '00000000-0000-4000-8000-0000000c7602', true) $$, '22023', null, 'retried as final, is refused');
reset role;
select is((select ended_at from public.seat_session where id = (select id from ids where name = 'again')), null, 'so he keeps his seat');

select * from finish();
rollback;
