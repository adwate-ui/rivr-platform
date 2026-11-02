-- At the table, from the app (#634). Call time is three hours (seed and setting). A seated member reads how long they have played
-- and their call time, extends it by an hour, asks for a top-up and leaves: with call time owed they go on the Leaving
-- list, with it done the seat opens. The floor (waitlist.manage: 103 Aditya) takes a top-up in hand and resets it.
-- 211 Ishaan and 212 Vihaan have finished their identity check; 213 Mihir is not seated; 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.t(p_name text) returns uuid language sql as $$
  select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = p_name;
$$;
grant execute on function pg_temp.as_person(text), pg_temp.t(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
create function pg_temp.top_up_of(p_name text) returns text language sql as $$
  select top_up from public.floor_seats('00000000-0000-4000-8000-000000000001') where full_name = p_name;
$$;
grant execute on function pg_temp.top_up_of(text) to authenticated;

select is((select count(*)::integer from public.table_type tt
           where (private.setting_at(tt.venue_id, 'call_time.minutes', tt.code, now()) ->> 'minutes')::integer < 180), 0,
  'every table type has at least three hours of call time');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'ishaan', public.seat_member(pg_temp.t('Table 3'), 2, '9000000211');
insert into ids select 'vihaan', public.seat_member(pg_temp.t('Table 3'), 3, '9000000212');
reset role;

-- Ishaan reads his seat: when play began, three hours to play, not leaving, no top-up.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq($$ select call_time_left, played_seconds between 0 and 5, is_leaving, top_up from public.my_seat() $$,
  $$ values (10800, true, false, null::text) $$, 'Ishaan sees how long he has played and three hours of call time');
select lives_ok($$ select public.extend_my_call_time() $$, 'he extends his call time');
select is((select call_time_left from public.my_seat()), 14400, 'by an hour');
select lives_ok($$ select public.request_top_up() $$, 'he asks for a top-up');
select lives_ok($$ select public.request_top_up() $$, 'and asking again changes nothing');
select is((select top_up from public.my_seat()), 'requested', 'his top-up is requested');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select throws_ok($$ select public.request_top_up() $$, '22023', null, 'Mihir, not seated, asks for no top-up');
select throws_ok($$ select public.extend_my_call_time() $$, '22023', null, 'extends no call time');
select throws_ok($$ select public.leave_my_seat() $$, '22023', null, 'and leaves no seat');
reset role;

-- The floor takes the top-up in hand, then resets it; a dealer does neither.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.set_top_up((select id from ids where name = 'ishaan'), true) $$, '42501', null, 'a dealer handles no top-up');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(pg_temp.top_up_of('Ishaan Verma'), 'requested', 'the floor sees Ishaan''s request');
select throws_ok($$ select public.set_top_up((select id from ids where name = 'vihaan'), true) $$, '22023', null,
  'and cannot take in hand a top-up nobody asked for');
select lives_ok($$ select public.set_top_up((select id from ids where name = 'ishaan'), true) $$, 'the floor takes it in hand');
select is(pg_temp.top_up_of('Ishaan Verma'), 'in_progress', 'it is in progress');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select top_up from public.my_seat()), 'in_progress', 'and Ishaan sees it so');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_top_up((select id from ids where name = 'ishaan'), false) $$, 'the floor resets it');
select is(pg_temp.top_up_of('Ishaan Verma'), null, 'so Ishaan can ask again');
reset role;

-- Leaving with call time owed puts Ishaan on the Leaving list; with it done, the seat opens, even while he is away,
-- and no more call time is added to it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is(public.leave_my_seat(), 'leaving', 'Ishaan leaves with call time owed');
select results_eq($$ select is_leaving from public.my_seat() $$, $$ values (true) $$, 'so he is still seated, on the Leaving list');
reset role;
update public.seat_session set started_at = started_at - interval '5 hours', away_since = now() - interval '10 minutes'
where id = (select id from ids where name = 'ishaan');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.extend_my_call_time() $$, '22023', null, 'with his call time done he adds none');
select is(public.leave_my_seat(), 'left', 'with his call time done he leaves');
select is((select count(*)::integer from public.my_seat()), 0, 'and has no seat');
reset role;
select results_eq($$ select end_reason, away_since is null, away_seconds >= 600 from public.seat_session where id = (select id from ids where name = 'ishaan') $$,
  $$ values ('left'::text, true, true) $$, 'the seat ended as left, his time away banked');
select is((select count(*)::integer from public.outbox_event where event_type = 'seat.left'
           and payload ->> 'session_id' = (select id::text from ids where name = 'ishaan')), 1, 'and seat.left is emitted once');

-- A tier without top-ups or call time asks for neither.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode)
select m.venue_id, m.tier_id, k.key, false, 'locked' from public.member m
cross join (values ('table.top_up'), ('call_time.view')) as k (key) where m.id = '00000000-0000-4000-8000-000000000212';
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.request_top_up() $$, '42501', null, 'without table.top_up Vihaan asks for no top-up');
select throws_ok($$ select public.extend_my_call_time() $$, '42501', null, 'and without call_time.view extends no call time');
reset role;

select is(has_function_privilege('anon', 'public.request_top_up()', 'execute'), false, 'nobody signed out asks for a top-up');
select is(has_function_privilege('anon', 'public.leave_my_seat()', 'execute'), false, 'nor leaves a seat');

select * from finish();
rollback;
