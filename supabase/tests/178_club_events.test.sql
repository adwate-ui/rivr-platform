-- The events calendar (#143): the club adds a pro night; members book and give back seats, never past its seats. 103
-- Aditya runs promotions; 104 is a cashier; 213 Mihir, 214 Yash and 215 Ritika are members.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Another venue, made first as its settings take effect when the test begins, with its own admin and member.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000998', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e3', 'authenticated', 'authenticated', '919000000997', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin');
insert into public.member (venue_id, user_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e3', 'Elsewhere Member', '+919000000997');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table night as select public.create_club_event('00000000-0000-4000-8000-000000000001', 'pro_night', 'Pro night with Sam', now() + interval '2 days', 2, 'Meet a pro')
  as id;
grant select on night to authenticated;
select throws_ok($$ select public.create_club_event('00000000-0000-4000-8000-000000000001', 'pro_night', 'Gone', now() - interval '1 hour', 2, null) $$,
  '22023', null, 'an event still to come');
select throws_ok($$ select public.create_club_event('00000000-0000-4000-8000-000000000001', 'party', 'Party', now() + interval '1 day', 2, null) $$,
  '22023', null, 'a pro night or a corporate table');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.create_club_event('00000000-0000-4000-8000-000000000001', 'pro_night', 'Mine', now() + interval '1 day', 2, null) $$,
  '42501', null, 'a cashier adds no event');

-- Two seats: Mihir and Yash book them; Ritika finds it full, until Yash gives his back.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select title, seats_left, is_booked from public.my_club_events() where event_id = (select id from night) $$,
  $$ values ('Pro night with Sam'::text, 2, false) $$, 'Mihir sees the pro night with its two seats');
select lives_ok($$ select public.book_club_event((select id from night), true) $$, 'and books one');
select lives_ok($$ select public.book_club_event((select id from night), true) $$, 'once, however often he asks');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select lives_ok($$ select public.book_club_event((select id from night), true) $$, 'Yash books the other');
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select throws_ok($$ select public.book_club_event((select id from night), true) $$, 'RVEVT', 'Every seat is booked', 'Ritika finds it full');
select pg_temp.as_person('00000000-0000-4000-8000-000000000214');
select lives_ok($$ select public.book_club_event((select id from night), false) $$, 'Yash gives his seat back');
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select lives_ok($$ select public.book_club_event((select id from night), true) $$, 'and Ritika takes it');
select is((select count(*)::integer from public.club_event_booking), 1, 'she sees only her own booking');
select is((select title from public.club_event where id = (select id from night)), 'Pro night with Sam', 'and reads the event itself');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select booked, seats from public.venue_club_events('00000000-0000-4000-8000-000000000001') where event_id = (select id from night) $$,
  $$ values (2, 2) $$, 'the floor reads two of two booked');
select is((select count(*)::integer from public.club_event_booking where event_id = (select id from night)), 2, 'and both bookings');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select is_empty($$ select 1 from public.venue_club_events('00000000-0000-4000-8000-000000000001') $$, 'another venue''s admin reads none of them');
select is_empty($$ select 1 from public.club_event_booking $$, 'nor their bookings');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e3');
select is_empty($$ select 1 from public.my_club_events() $$, 'another venue''s member sees none of them');
select throws_ok($$ select public.book_club_event((select id from night), true) $$, '42501', null, 'and books none');

-- Without events in their tier, a member sees and books nothing.
reset role;
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'events.book', false, 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is_empty($$ select 1 from public.my_club_events() $$, 'a member without events sees none');
select throws_ok($$ select public.book_club_event((select id from night), true) $$, '42501', null, 'and books none');
-- Once it has started, nothing changes.
reset role;
update public.club_event set starts_at = now() - interval '1 minute' where id = (select id from night);
select pg_temp.as_person('00000000-0000-4000-8000-000000000215');
select throws_ok($$ select public.book_club_event((select id from night), false) $$, 'RVEVT', 'This event has started', 'a started event keeps its bookings');
reset role;

select * from finish();
rollback;
