-- Waitlist call-down follow-ups (#287; decision 0044). The seed puts Kabir (202), Naina (203) and Rohan (204) on 100/200;
-- 103 Aditya is the floor. The floor's Skip rolls the seat to the next name, and needs time away left; a member freeze
-- pauses a place's time away; the seat call's payload is what the WhatsApp consumer reads.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.type_id(p_code text) returns uuid language sql as $$
  select id from public.table_type where code = p_code and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.entry(p_member uuid) returns uuid language sql as $$
  select id from public.waitlist_entry where member_id = p_member and table_type_id = pg_temp.type_id('nlh_100_200') and status = 'waiting';
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.type_id(text), pg_temp.table_id(text), pg_temp.entry(uuid), pg_temp.as_person(text) to authenticated;

-- Kabir and Rohan have finished the identity check; the order is pinned: Kabir, Naina, Rohan.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', m.id, 'verified', 'digilocker', '1990-01-01', m.pan,
       '00000000-0000-4000-8000-000000000001/' || m.id || '/selfie.jpg', now()
from (values ('00000000-0000-4000-8000-000000000202'::uuid, 'ABCPK2022K'), ('00000000-0000-4000-8000-000000000204'::uuid, 'ABCPR2044R')) as m (id, pan)
on conflict (member_id) do update set status = 'verified', verified_at = now();
update public.waitlist_entry set joined_at = now() - interval '30 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000202');
update public.waitlist_entry set joined_at = now() - interval '29 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000203');
update public.waitlist_entry set joined_at = now() - interval '28 minutes' where id = pg_temp.entry('00000000-0000-4000-8000-000000000204');

-- The floor calls Kabir to Table 3, seat 9; the seat call carries what the WhatsApp consumer reads.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.call_from_waitlist(pg_temp.entry('00000000-0000-4000-8000-000000000202'), pg_temp.table_id('Table 3'), 9) $$,
  'the floor calls Kabir to Table 3, seat 9');
reset role;
select results_eq(
  $$ select payload ->> 'member_id', payload ->> 'table_name', jsonb_typeof(payload -> 'seat'), (payload ->> 'seat')::integer,
            (payload ->> 'hold_until')::timestamptz > now()
     from public.outbox_event where event_type = 'waitlist.called' and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000202'
     order by created_at desc limit 1 $$,
  $$ values ('00000000-0000-4000-8000-000000000202'::text, 'Table 3'::text, 'number'::text, 9, true) $$,
  'the seat call names the member, the table, the seat as a number and when the hold ends, as the consumer reads them');

-- Skip rolls the seat to the next name who can take it: Naina has not finished the check, so Rohan.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000202'), true) $$, 'the floor skips Kabir');
reset role;
select results_eq($$ select e.member_id, ct.name, e.call_seat from public.waitlist_entry e join public.game_table ct on ct.id = e.call_table_id
                     where e.table_type_id = pg_temp.type_id('nlh_100_200') and e.status = 'waiting' and e.called_at is not null $$,
  $$ values ('00000000-0000-4000-8000-000000000204'::uuid, 'Table 3'::text, 9) $$, 'and the next name waiting is called to the seat');

-- A Skip with no time away left is refused, rather than taking the place off at the next minute.
update public.waitlist_entry set away_used = interval '1 day' where id = pg_temp.entry('00000000-0000-4000-8000-000000000204');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.step_away(pg_temp.entry('00000000-0000-4000-8000-000000000204'), true) $$, 'RVAWY', null,
  'the floor cannot skip a called member with no time away left');
reset role;
update public.waitlist_entry set away_used = interval '0' where id = pg_temp.entry('00000000-0000-4000-8000-000000000204');

-- A member frozen while away keeps their place: their time away pauses.
update public.waitlist_entry set stepped_away_at = now() - interval '1 day' where id = pg_temp.entry('00000000-0000-4000-8000-000000000202');
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000202', 'Test');
select lives_ok($$ select private.expire_waitlist_holds() $$, 'the minute''s run');
select is((select status from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000202' and table_type_id = pg_temp.type_id('nlh_100_200')
           order by joined_at limit 1), 'waiting', 'leaves a frozen member''s place, however long they have been away');
select is((select stepped_away_at > now() - interval '1 day' from public.waitlist_entry where id = pg_temp.entry('00000000-0000-4000-8000-000000000202')), true,
  'and moves their time away on, as a venue freeze does');
select ok(private.is_waitlist_paused('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202'), 'a frozen member''s places pause');

select ok(not private.is_waitlist_paused('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000204'), 'nobody else''s');

-- A frozen member's seat call still runs out, so the seat rolls on.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000204', 'Test');
update public.waitlist_entry set hold_until = now() - interval '1 minute' where id = pg_temp.entry('00000000-0000-4000-8000-000000000204');
select private.expire_waitlist_holds();
select is((select left_reason from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000204' and table_type_id = pg_temp.type_id('nlh_100_200')
           order by joined_at desc limit 1), 'missed', 'a frozen member''s seat call runs out all the same');

select * from finish();
rollback;
