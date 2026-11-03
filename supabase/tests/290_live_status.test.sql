-- Lock-screen live status (decision 0323, phase 2; decisions 0360 and 0361): a member's phones in the native shell, what
-- each shows (waiting, seat ready, seated) read at send time, the list's move event, and who may touch which phone.
-- Ishaan (211) and Vihaan (212) are members; 103 Aditya is the floor; Table 5 is open.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.number_of(p_member uuid) returns bigint language sql as $$
  select member_number from public.member where id = p_member;
$$;
grant execute on function pg_temp.table_id(text), pg_temp.as_person(text), pg_temp.number_of(uuid) to authenticated;
create function pg_temp.owner_of(p_token text) returns uuid language sql as $$
  select member_id from public.live_status_device where push_token = p_token;
$$;
create function pg_temp.status_of(p_member uuid) returns table (state text, table_name text, seat integer, game text, place integer,
                                                                 starts_at timestamptz, ends_at timestamptz, can_order boolean, entry_id uuid)
language sql as $$
  select state, table_name, seat, game, place, starts_at, ends_at, can_order, entry_id
  from public.live_status_targets('00000000-0000-4000-8000-000000000001', p_member) where member_id = p_member limit 1;
$$;

-- Every status needs its push and the seat's call time and food: give Ishaan and Vihaan them whatever their tier says.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', m, f, true, 'test 290'
from unnest(array['00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000212']::uuid[]) m,
     unnest(array['push.seat_ready', 'push.call_time_complete', 'call_time.view', 'fnb.table_side']) f
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------
-- A member's phones: saved with a key the phone keeps; another member takes a phone only with that key.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
create temp table ishaan_key on commit drop as
  select public.save_live_status_device('android', 'ishaan-phone:APA91bAndroidRegistrationToken', null) as device_key;
grant select, update on ishaan_key to authenticated;
select matches((select device_key from ishaan_key), '^[0-9a-f]{64}$', 'Ishaan saves his phone and it keeps a key of its own');
select throws_ok($$ select public.save_live_status_device('android', 'short', null) $$, '23514', null, 'a token must look like one');
select throws_ok($$ select public.save_live_status_device('ios', 'ishaan-phone:APA91bAndroidRegistrationToken2', null) $$, '23514', null,
  'an iPhone''s token is hex');
select throws_ok($$ select public.save_live_status_device('windows', repeat('a1', 32), null) $$, '23514', null, 'only an iPhone or an Android phone');
select is(public.save_live_status_device('android', 'ishaan-phone:APA91bAndroidRegistrationToken', (select device_key from ishaan_key)),
  (select device_key from ishaan_key), 'saved again with the key it kept, the phone keeps its key');
select isnt(public.save_live_status_device('android', 'ishaan-phone:APA91bAndroidRegistrationToken', null), (select device_key from ishaan_key),
  'his own phone without its key (reinstalled) gets a new one');
update ishaan_key set device_key = public.save_live_status_device('android', 'ishaan-phone:APA91bAndroidRegistrationToken', null);
select public.save_live_status_device('android', 'ishaan-phone:APA91bNewRegistrationToken', (select device_key from ishaan_key));
reset role;
select results_eq($$ select push_token from public.live_status_device where member_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ values ('ishaan-phone:APA91bNewRegistrationToken'::text) $$, 'the key names one phone: its row under the old token goes');
delete from public.live_status_device where push_token = 'ishaan-phone:APA91bNewRegistrationToken';
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
update ishaan_key set device_key = public.save_live_status_device('android', 'ishaan-phone:APA91bAndroidRegistrationToken', null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.save_live_status_device('android', 'ishaan-phone:APA91bAndroidRegistrationToken', null) $$, '42501', null,
  'Vihaan, knowing the token of Ishaan''s phone but not its key, cannot take it');
select lives_ok($$ select public.remove_live_status_device('ishaan-phone:APA91bAndroidRegistrationToken') $$, 'turning it off');
reset role;
select is(pg_temp.owner_of('ishaan-phone:APA91bAndroidRegistrationToken'), '00000000-0000-4000-8000-000000000211'::uuid, 'changes nothing: it stays his');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select matches(public.save_live_status_device('android', 'ishaan-phone:APA91bAndroidRegistrationToken', (select device_key from ishaan_key)),
  '^[0-9a-f]{64}$', 'Vihaan signs in on the same phone, which presents its key');
reset role;
select is(pg_temp.owner_of('ishaan-phone:APA91bAndroidRegistrationToken'), '00000000-0000-4000-8000-000000000212'::uuid, 'and the phone moves to him');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.remove_live_status_device('ishaan-phone:APA91bAndroidRegistrationToken') $$, 'Vihaan turns it off');
reset role;
select is(pg_temp.owner_of('ishaan-phone:APA91bAndroidRegistrationToken'), null, 'and it is gone');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.save_live_status_device('android', 'staff-phone:APA91bAndroidRegistrationToken', null) $$, '42501', null,
  'only a member has a live status');
select throws_ok($$ select * from public.live_status_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  '42501', null, 'staff cannot read where statuses go');
select throws_ok($$ select * from public.live_status_device $$, '42501', null, 'nor the phones');
reset role;

-- A member keeps five phones at most, their latest.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select public.save_live_status_device('android', 'ishaan-phone-' || n || ':APA91bAndroidRegistrationToken', null) from generate_series(1, 6) n;
reset role;
select is((select count(*)::integer from public.live_status_device where member_id = '00000000-0000-4000-8000-000000000211'), 5,
  'a member keeps five phones at most');
delete from public.live_status_device where member_id = '00000000-0000-4000-8000-000000000211';

-- An iPhone reports the token of a Live Activity started by push with its key alone, through the live-status-token
-- function (the web view may not be running, so there is no session).
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
create temp table iphone_key on commit drop as select public.save_live_status_device('ios', repeat('a1', 32), null) as device_key;
create temp table android_key on commit drop as
  select public.save_live_status_device('android', 'ishaan-tablet:APA91bAndroidRegistrationToken', null) as device_key;
grant select on iphone_key, android_key to anon, authenticated, service_role;
select throws_ok(format('select public.report_live_status_token(%L, %L)', (select device_key from iphone_key), repeat('b2', 32)),
  '42501', null, 'not straight from the app');
reset role;
set local role anon;
select throws_ok(format('select public.report_live_status_token(%L, %L)', (select device_key from iphone_key), repeat('b2', 32)),
  '42501', null, 'nor by anyone signed out');
select throws_ok($$ select * from public.live_status_device $$, '42501', null, 'who cannot read the phones either');
reset role;
set local role service_role;
select lives_ok(format('select public.report_live_status_token(%L, %L)', (select device_key from iphone_key), repeat('b2', 32)),
  'the function reports the iPhone''s Live Activity token');
select lives_ok(format('select public.report_live_status_token(%L, %L)', repeat('0', 64), repeat('c3', 32)),
  'a wrong key reports nothing');
select lives_ok(format('select public.report_live_status_token(%L, %L)', (select device_key from android_key), repeat('c3', 32)),
  'nor an Android phone''s key');
reset role;
select is((select activity_push_token from public.live_status_device where push_token = repeat('a1', 32)), repeat('b2', 32), 'the right key''s token is kept');
select is((select count(*)::integer from public.live_status_device where activity_push_token = repeat('c3', 32)), 0, 'the others are not');
delete from public.live_status_device where push_token = 'ishaan-tablet:APA91bAndroidRegistrationToken';

-- ---------------------------------------------------------------------------------------------------
-- What each phone shows, read when it is sent. Vihaan's phone too, for the list's other members.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select public.save_live_status_device('android', 'vihaan-phone:APA91bAndroidRegistrationToken', null);
reset role;
select results_eq($$ select state from pg_temp.status_of('00000000-0000-4000-8000-000000000211') $$, $$ values (null::text) $$,
  'on no list and in no seat, Ishaan''s phone shows nothing');

-- Ishaan asks to join at Table 5: waiting, with no place until the floor approves; the list moved.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, approved_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', g.table_type_id, g.id, '00000000-0000-4000-8000-00000000a290', null
from public.game_table g where g.id = pg_temp.table_id('Table 5');
create temp table ishaan_place on commit drop as
  select id from public.waitlist_entry where idempotency_key = '00000000-0000-4000-8000-00000000a290';
select results_eq($$ select state, table_name, place, game from pg_temp.status_of('00000000-0000-4000-8000-000000000211') $$,
  $$ select 'waiting'::text, 'Table 5'::text, null::integer, t.name from public.game_table g join public.table_type t on t.id = g.table_type_id
     where g.id = pg_temp.table_id('Table 5') $$,
  'asked to join at Table 5: waiting, the table and game, no place yet');
select results_eq($$ select payload from public.outbox_event where event_type = 'waitlist.moved' and payload ->> 'entry_id' = (select id::text from ishaan_place) $$,
  $$ select jsonb_build_object('entry_id', (select id from ishaan_place), 'member_id', '00000000-0000-4000-8000-000000000211'::uuid,
                               'table_type_id', (select table_type_id from public.game_table where id = pg_temp.table_id('Table 5'))) $$,
  'the list moved: waitlist.moved names the place, the member and the list');
update public.waitlist_entry set approved_at = now() where id = (select id from ishaan_place);
select ok((select place is not null from pg_temp.status_of('00000000-0000-4000-8000-000000000211')), 'approved: he has a place');
select is((select count(*)::integer from public.outbox_event where event_type = 'waitlist.moved' and payload ->> 'entry_id' = (select id::text from ishaan_place)),
  2, 'and the list moved again');
update public.waitlist_entry set on_way_at = now() where id = (select id from ishaan_place);
select is((select count(*)::integer from public.outbox_event where event_type = 'waitlist.moved' and payload ->> 'entry_id' = (select id::text from ishaan_place)),
  2, 'a change that moves no place is no move');

-- Vihaan waits on the same list: an event of Ishaan's list reaches his phone too, with his own place.
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, approved_at)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', g.table_type_id, g.id, '00000000-0000-4000-8000-00000000b290', now()
from public.game_table g where g.id = pg_temp.table_id('Table 5');
select results_eq(
  $$ select member_id, state from public.live_status_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
                                                               (select table_type_id from public.game_table where id = pg_temp.table_id('Table 5')))
     order by member_id $$,
  $$ values ('00000000-0000-4000-8000-000000000211'::uuid, 'waiting'::text), ('00000000-0000-4000-8000-000000000212'::uuid, 'waiting'::text) $$,
  'the list''s event reaches everyone waiting on it');
select results_eq(
  $$ select member_id from public.live_status_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  $$ values ('00000000-0000-4000-8000-000000000211'::uuid) $$, 'and a member''s own event, only their phones');

-- Called to Table 5, seat 4: seat ready, counting down from the call to the hold's end, which "I'm on my way" answers.
update public.waitlist_entry set called_at = now(), hold_until = now() + interval '20 minutes', call_table_id = pg_temp.table_id('Table 5'), call_seat = 4
where id = (select id from ishaan_place);
select results_eq($$ select state, table_name, seat, starts_at, ends_at, entry_id from pg_temp.status_of('00000000-0000-4000-8000-000000000211') $$,
  $$ values ('seat_ready'::text, 'Table 5'::text, 4, date_trunc('second', now()), date_trunc('second', now() + interval '20 minutes'),
             (select id from ishaan_place)) $$,
  'called: seat ready at Table 5, seat 4, held from the call for twenty minutes');
select is((select count(*)::integer from public.outbox_event where event_type = 'waitlist.moved' and payload ->> 'entry_id' = (select id::text from ishaan_place)),
  3, 'a call moves the list too');
update public.waitlist_entry set hold_until = now() - interval '1 second' where id = (select id from ishaan_place);
select is((select state from pg_temp.status_of('00000000-0000-4000-8000-000000000211')), 'waiting', 'a hold run out is no seat ready');
update public.waitlist_entry set hold_until = now() + interval '20 minutes' where id = (select id from ishaan_place);
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select public.set_my_notification('push.seat_ready', false);
reset role;
select is((select state from pg_temp.status_of('00000000-0000-4000-8000-000000000211')), null, 'seat calls turned off: nothing shows');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select public.set_my_notification('push.seat_ready', true);
reset role;

-- The floor skips him: the call is taken back with no event of its own, so the list moves and his phone shows waiting.
update public.waitlist_entry set called_at = null, hold_until = null, call_table_id = null, call_seat = null where id = (select id from ishaan_place);
select is((select count(*)::integer from public.outbox_event where event_type = 'waitlist.moved' and payload ->> 'entry_id' = (select id::text from ishaan_place)),
  4, 'a call taken back moves the list');
select is((select state from pg_temp.status_of('00000000-0000-4000-8000-000000000211')), 'waiting', 'and his phone shows his place again');

-- Seated for an hour: the call time counts down to its end; away, it does not count; Order with the seat's food.
update public.waitlist_entry set status = 'left', left_at = now(), left_reason = 'left' where id = (select id from ishaan_place);
select is((select count(*)::integer from public.outbox_event where event_type = 'waitlist.moved' and payload ->> 'entry_id' = (select id::text from ishaan_place)),
  5, 'leaving the list moves it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => pg_temp.number_of('00000000-0000-4000-8000-000000000211'), p_call_minutes => 60);
reset role;
update public.seat_session set started_at = now() - interval '10 minutes', seated_here_at = now() - interval '10 minutes', away_seconds = 120
where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select results_eq($$ select state, table_name, seat, starts_at, ends_at, can_order from pg_temp.status_of('00000000-0000-4000-8000-000000000211') $$,
  $$ values ('seated'::text, 'Table 5'::text, 2, date_trunc('second', now() - interval '8 minutes'),
             date_trunc('second', now() + interval '52 minutes'), true) $$,
  'seated: the hour counts down from the start, less the time away, with Order');
update public.seat_session set away_since = now() where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select results_eq($$ select state, ends_at from pg_temp.status_of('00000000-0000-4000-8000-000000000211') $$, $$ values ('seated'::text, null::timestamptz) $$,
  'away: the call time does not run');

-- Never at the practice venue, nor at another venue (erasure deletes a member's phones, below).
insert into public.live_status_device (venue_id, member_id, platform, push_token, device_key_hash)
select m.venue_id, m.id, 'android', 'practice-phone:APA91bAndroidRegistrationToken', repeat('d', 64)
from public.member m join public.venue v on v.id = m.venue_id and v.is_practice limit 1;
select is_empty($$ select * from public.live_status_targets((select id from public.venue where is_practice),
                                                            (select member_id from public.live_status_device where push_token = 'practice-phone:APA91bAndroidRegistrationToken')) $$,
  'never at the practice venue');
select is_empty($$ select * from public.live_status_targets('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000211') $$,
  'nor for a member of another venue');

-- A purge's reload (the practice reset) brings places back with no event (20261021130000_practice_reset.sql).
create temp table reloaded on commit drop as
  select m.id as member_id from public.member m
  where m.venue_id = '00000000-0000-4000-8000-000000000001' and m.erased_at is null
    and m.id not in ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000212')
    and not exists (select 1 from public.waitlist_entry e where e.member_id = m.id and e.status = 'waiting')
  limit 1;
select set_config('rivr.purge', 'on', true), set_config('rivr.purge_venue', '00000000-0000-4000-8000-000000000001', true);
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, approved_at)
select '00000000-0000-4000-8000-000000000001', (select member_id from reloaded), g.table_type_id, g.id, '00000000-0000-4000-8000-00000000c290', now()
from public.game_table g where g.id = pg_temp.table_id('Table 5');
select set_config('rivr.purge', '', true), set_config('rivr.purge_venue', '', true);
select is((select count(*)::integer from public.outbox_event where event_type = 'waitlist.moved' and payload ->> 'member_id' = (select member_id::text from reloaded)),
  0, 'a place a purge reloads moves no list');

-- Leaving the seat (seat.left) ends what shows.
update public.seat_session set ended_at = now(), end_reason = 'left', away_since = null where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;
select is((select state from pg_temp.status_of('00000000-0000-4000-8000-000000000211')), null, 'seat left: nothing shows');

-- What the consumer keeps: what a phone shows; nothing shown ends an iPhone's Live Activity; a phone whose token is gone.
select lives_ok($$ select public.note_live_status_shown((select id from public.live_status_device where push_token = repeat('a1', 32)), '{"kind":"seated"}') $$,
  'the consumer notes what an iPhone shows');
select results_eq($$ select shown, activity_push_token from public.live_status_device where push_token = repeat('a1', 32) $$,
  $$ values ('{"kind":"seated"}'::text, repeat('b2', 32)) $$, 'kept with its Live Activity');
select public.note_live_status_shown((select id from public.live_status_device where push_token = repeat('a1', 32)), null);
select results_eq($$ select shown, activity_push_token from public.live_status_device where push_token = repeat('a1', 32) $$,
  $$ values (null::text, null::text) $$, 'once it shows nothing, its Live Activity has ended');
select lives_ok($$ select public.forget_live_status_device((select id from public.live_status_device where push_token = 'vihaan-phone:APA91bAndroidRegistrationToken')) $$,
  'a phone whose token is gone');
select is(pg_temp.owner_of('vihaan-phone:APA91bAndroidRegistrationToken'), null, 'is forgotten');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select public.note_live_status_shown(gen_random_uuid(), null) $$, '42501', null, 'only the consumer notes what shows');
select throws_ok($$ select public.forget_live_status_device(gen_random_uuid()) $$, '42501', null, 'or forgets a phone');
reset role;

-- A frozen member saves no phone (the kill switch, assert_writable).
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000212', 'Test 290');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.save_live_status_device('android', 'vihaan-phone:APA91bAndroidRegistrationToken', null) $$, 'RVMBR', null,
  'a frozen member saves no phone');
reset role;

-- Erasure deletes a member's phones.
select private.delete_member_records(m) from public.member m where m.id = '00000000-0000-4000-8000-000000000211';
select is((select count(*)::integer from public.live_status_device where member_id = '00000000-0000-4000-8000-000000000211'), 0,
  'erasing a member deletes their phones');

select * from finish();
rollback;
