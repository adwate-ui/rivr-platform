-- Check-in (#72). The seed puts Kabir (202), Naina (203) and Rohan (204) on 100/200, not yet in the
-- room; 201 Arjun is a member; 213 Mihir takes a break; 103 Aditya is the floor (waitlist.manage,
-- members.read); 104 is a cashier (members.read); 106 Pema is a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Arjun's seeded identity check (#21) is set aside: this test takes him through the door as it was written for.
delete from public.kyc_record where member_id = '00000000-0000-4000-8000-000000000201';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- The door's lists.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select full_name, tier_name, is_in_room from public.door_board('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Kabir Sethi'::text, 'Member'::text, false), ('Naina Kapoor', 'Member', false), ('Rohan Bhatia', 'Member', false) $$,
  'expected: the members on a waitlist, earliest first; no one in the room yet');
create temp table first_visit as
  select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') as id;
grant select on first_visit to authenticated;
select isnt((select id from first_visit), null, 'the front desk checks Kabir in from the expected list');
select is(public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202'), (select id from first_visit),
  'checking him in again gives the same visit');
-- now() stands still in a test, so Kabir is put in a minute before Arjun: "earliest first" needs an order.
reset role;
update public.visit set opened_at = now() - interval '1 minute' where id = (select id from first_visit);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '90000 00201'), null, 'and Arjun by his mobile number');
select results_eq($$ select full_name, is_in_room from public.door_board('00000000-0000-4000-8000-000000000001') $$,
  $$ values ('Naina Kapoor'::text, false), ('Rohan Bhatia', false), ('Kabir Sethi', true), ('Arjun Mehta', true) $$,
  'Kabir leaves the expected list; both are in the room, earliest first');
select throws_ok($$ select public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000999') $$, 'RVNOM', null,
  'a number no member has is refused');
select throws_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301') $$, 'RVNOM', null,
  'as is a member of another venue');

-- A member on a break is refused, with the reason.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select isnt(public.take_break(1), null, 'Mihir takes a 24-hour break');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000213') $$, 'RVBRK', null,
  'a member on a break is refused at the door');

-- Only the front desk checks in.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203') $$, '42501', null,
  'a dealer does not check members in');
select is_empty($$ select * from public.door_board('00000000-0000-4000-8000-000000000001') $$, 'nor sees the door''s lists');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201') $$, '42501', null,
  'nor does a member check themselves in');
reset role;
set local role anon;
select throws_ok($$ select public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000201') $$, '42501', null,
  'nor anyone signed out');
reset role;
select is((select count(*)::integer from public.outbox_event where event_type = 'visit.opened'), 2, 'visit.opened is emitted once per visit');

-- Who sees visits: the member their own, staff who read members the venue's.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is((select count(*)::integer from public.visit), 1, 'Kabir sees his own visit');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select is_empty($$ select * from public.visit $$, 'Naina sees none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
-- The two opened here, and Kunal Mehra's, Neel Bose's and Devansh Malik's three past visits each (seed, #73, #74, #92).
select is((select count(*)::integer from public.visit), 11, 'a cashier sees the venue''s visits');
select throws_ok($$ update public.visit set closed_at = now(), close_reason = 'door' $$, '42501', null, 'but changes none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select * from public.visit $$, 'a dealer sees none');
reset role;
update public.staff set is_active = false
where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.visit $$, 'staff at the practice venue only see none of the club''s');
reset role;

-- A frozen member, and anyone while the venue is frozen, is refused with the reason.
insert into public.control_state (venue_id, level, member_id, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000203', 'Dispute', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203') $$, 'RVMBR', null,
  'a frozen member is refused at the door');
reset role;
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204') $$, 'RVFRZ', null,
  'and nobody is checked in while the venue is frozen');

select * from finish();
rollback;
