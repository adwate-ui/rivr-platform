-- A purge takes two super admins (audit of 28 Oct, A4-13): owner 101 asks for the purge of the frozen club, saying why;
-- only general manager 102, another super admin, carries it out. Aditya 103, an admin, asks for none.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.as_system() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
grant execute on function pg_temp.as_system() to authenticated;

insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'A4-13 test');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.ask_live_purge('00000000-0000-4000-8000-000000000001', 'Closing the club for good') $$, '42501', null,
  'an admin asks for no purge');


select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
-- A4-13: the owner asks for the purge; only another super admin carries it out.
select throws_ok($$ select public.ask_live_purge('00000000-0000-4000-8000-000000000001', 'Too short') $$, '22023', null,
  'an ask says why, in 10 characters or more');
create temporary table asked on commit drop as
select public.ask_live_purge('00000000-0000-4000-8000-000000000001', 'Closing the club for good') as request_id;
grant select on asked to authenticated;
select isnt((select request_id from asked), null, 'the owner asks for the purge of the frozen club');
select is(public.ask_live_purge('00000000-0000-4000-8000-000000000001', 'Asking again the same day'), (select request_id from asked),
  'asking again gives the same ask');
select results_eq($$ select asked_by, is_mine from public.open_purge_request('00000000-0000-4000-8000-000000000001') $$,
  $$ select full_name, true from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  'and sees it is their own');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-000000000001',
                    (select name from public.venue where id = '00000000-0000-4000-8000-000000000001')) $$,
  'RVTWO', null, 'the super admin who asked does not carry it out');

select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select results_eq($$ select is_mine from public.open_purge_request('00000000-0000-4000-8000-000000000001') $$, $$ values (false) $$,
  'the general manager sees another''s ask');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-000000000001',
                    (select name from public.venue where id = '00000000-0000-4000-8000-000000000001')) $$,
  'RVARC', null, 'and may carry it out, once their own saved archive is recent, as before');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.purge_request), 0, 'an admin reads no ask');
select is_empty($$ select * from public.open_purge_request('00000000-0000-4000-8000-000000000001') $$, 'and is told of none');

-- An ask more than a day old allows no purge.
select pg_temp.as_system();
update public.purge_request set asked_at = now() - interval '25 hours' where id = (select request_id from asked);
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-000000000001', (select name from public.venue where id = '00000000-0000-4000-8000-000000000001')) $$,
  'RVTWO', null, 'an ask more than a day old allows no purge');
select pg_temp.as_system();
update public.purge_request set asked_at = now() where id = (select request_id from asked);

-- One person with a second login is not two: the asker made or changed the other's staff row.
insert into public.audit_log (venue_id, actor_user_id, action, entity, entity_id)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'insert', 'staff', s.id::text
from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.user_id = '00000000-0000-4000-8000-000000000102';
select pg_temp.as_person('00000000-0000-4000-8000-000000000102');
select throws_ok($$ select * from public.purge_live_venue('00000000-0000-4000-8000-000000000001', (select name from public.venue where id = '00000000-0000-4000-8000-000000000001')) $$,
  'RVTWO', null, 'a login the asker made does not carry out their purge');

-- An ask from before the freeze counts for nothing once the freeze is released and engaged again.
select pg_temp.as_system();
update public.control_state set released_at = now(), release_reason = 'Called off',
  released_by_staff_id = (select id from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000101'),
  release_second_staff_id = (select id from public.staff where venue_id = '00000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000102')
where venue_id = '00000000-0000-4000-8000-000000000001' and level = 'venue_freeze' and released_at is null;
insert into public.control_state (venue_id, level, reason, engaged_at) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Again', now() + interval '1 second');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is_empty($$ select * from public.open_purge_request('00000000-0000-4000-8000-000000000001') $$, 'an ask from before the freeze is gone once it is engaged again');

select pg_temp.as_system();
select is((select count(*)::integer from public.alert where venue_id = '00000000-0000-4000-8000-000000000001' and kind = 'purge.asked'), 1,
  'the owner is told of the ask once');
select ok('purge_request' = any (private.live_purge_keeps()), 'and a purge keeps the ask that allowed it');

select * from finish();
rollback;
