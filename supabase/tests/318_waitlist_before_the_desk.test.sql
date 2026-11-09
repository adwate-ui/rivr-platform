-- A member let in by their selfie waits before the desk has checked them (decision 0503): Uday (418) joins Table 3's list
-- from the app and the floor calls him, but seating him is refused until a host checks his ID at the desk; then the floor
-- seats him. Abhay (413), with no check at all, still joins nothing. 108 Karan is a host; 111 Zoya the floor's host.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create temp table board as select * from public.waitlist_board('00000000-0000-4000-8000-000000000001') limit 0;
grant all on board to authenticated;
create function pg_temp.entry() returns uuid language sql as $$
  select id from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000418' and status = 'waiting';
$$;
grant execute on function pg_temp.as_user(uuid), pg_temp.table_id(text), pg_temp.entry() to authenticated;

-- Uday's selfie came in while the club checked identity at the desk (20261108110000_kyc_at_the_club.sql).
insert into public.kyc_record (venue_id, member_id, at_club_from)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000418', now() - interval '1 day');
select is(private.may_wait('00000000-0000-4000-8000-000000000418'), true, 'a member let in by their selfie may wait');
select is(private.may_wait('00000000-0000-4000-8000-000000000413'), false, 'one with no check may not');
select is(private.is_kyc_complete('00000000-0000-4000-8000-000000000418'), false, 'and Uday may not play yet');

select pg_temp.as_user('00000000-0000-4000-8000-000000000413');
select throws_ok($$ select public.join_waitlist_at(pg_temp.table_id('Table 3'), gen_random_uuid()) $$, 'RVKYC', null,
  'a member with no check joins no list');
select pg_temp.as_user('00000000-0000-4000-8000-000000000418');
select lives_ok($$ select public.join_waitlist_at(pg_temp.table_id('Table 3'), gen_random_uuid()) $$,
  'Uday joins Table 3''s list from the app before the desk has checked him');
reset role;

-- The floor approves his join, then sees that his ID needs checking.
select pg_temp.as_user('00000000-0000-4000-8000-000000000111');
select lives_ok($$ select public.approve_waitlist_request(pg_temp.entry()) $$, 'the floor approves his join');
select is((select needs_id_check from public.waitlist_board('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000418'),
  true, 'and the floor''s list says his ID needs checking');
insert into board select * from public.waitlist_board('00000000-0000-4000-8000-000000000001');
reset role;
select is((select bool_or(b.needs_id_check <> not private.is_kyc_complete(b.member_id)) from board b), false,
  'every place says it needs an ID check exactly when the member''s check is not finished');
select pg_temp.as_user('00000000-0000-4000-8000-000000000111');

-- Assigning him a seat at once is refused before the desk's check, and leaves no call behind.
select throws_ok($$ select public.assign_from_waitlist(pg_temp.entry(), pg_temp.table_id('Table 3'), 8, 180) $$, 'RVKYC', null,
  'assigning him a seat at once is refused before the desk''s check');
select is((select called_at from public.waitlist_entry where id = pg_temp.entry()), null, 'and leaves no call behind');
-- The floor calls him: allowed. Seating him is refused until the desk's check.
select lives_ok($$ select public.call_from_waitlist(pg_temp.entry(), pg_temp.table_id('Table 3'), 9) $$, 'the floor calls him to a seat');
select throws_ok($$ select public.seat_from_waitlist(pg_temp.entry()) $$, 'RVKYC', null, 'but seating him is refused before the desk''s check');
reset role;
select is((select count(*)::integer from public.seat_session where member_id = '00000000-0000-4000-8000-000000000418'), 0, 'he sits nowhere');

-- At the desk: Karan checks his originals, and the floor seats him.
create function pg_temp.desk_check() returns text language plpgsql as $$
declare
  v_path text := public.authorize_in_person_kyc('00000000-0000-4000-8000-000000000418');
begin
  set local role postgres;
  insert into storage.objects (bucket_id, name) values ('kyc', v_path), ('kyc', replace(v_path, '/in-person-', '/doc-pan-')), ('kyc', replace(v_path, '/in-person-', '/doc-aadhaar-'));
  set local role authenticated;
  return public.check_kyc_in_person('00000000-0000-4000-8000-000000000418', v_path, '1991-03-18', '4180', 'UDAPT4180T', true, replace(v_path, '/in-person-', '/doc-pan-'), replace(v_path, '/in-person-', '/doc-aadhaar-'), true);
end;
$$;
grant execute on function pg_temp.desk_check() to authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000108');
select is(pg_temp.desk_check(), 'verified', 'the host verifies him at the desk');
select pg_temp.as_user('00000000-0000-4000-8000-000000000111');
select is((select needs_id_check from public.waitlist_board('00000000-0000-4000-8000-000000000001') where member_id = '00000000-0000-4000-8000-000000000418'),
  false, 'his place no longer needs an ID check');
select lives_ok($$ select public.seat_from_waitlist(pg_temp.entry()) $$, 'and the floor seats him');
reset role;
select is((select count(*)::integer from public.seat_session where member_id = '00000000-0000-4000-8000-000000000418' and ended_at is null), 1,
  'he sits at Table 3');

-- A desk check refused (a duplicate, here) ends his wait for the desk: he may wait no more.
update public.kyc_record set status = 'refused', refusal = 'staff_rejected', verified_at = null
where member_id = '00000000-0000-4000-8000-000000000418';
select is(private.may_wait('00000000-0000-4000-8000-000000000418'), false, 'a refused check may not wait');

select * from finish();
rollback;
