-- Web push (#139, #338; decision 0272): a member's phones, where each kind of push goes, and tournament starting.
-- Kabir (202) and Naina (203) are members whose tier has every push; 103 Aditya is staff.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.owner_of(p_endpoint text) returns uuid language sql as $$
  select member_id from public.push_subscription where endpoint = p_endpoint;
$$;

-- A member saves a phone; the same browser signed in by another member moves to them; each removes only their own.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select lives_ok($$ select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/one', 'BKabirP256dhKeyAAAAAAAAAAAA', 'kabirAuth123') $$, 'Kabir turns notifications on for his phone');
select throws_ok($$ select public.save_push_subscription('http://fcm.googleapis.com/fcm/send/two', 'BKabirP256dhKeyAAAAAAAAAAAA', 'kabirAuth123') $$, '23514', null,
  'a push address is https');
select throws_ok($$ select public.save_push_subscription('https://attacker.example/hold', 'BKabirP256dhKeyAAAAAAAAAAAA', 'kabirAuth123') $$, '23514', null,
  'and a browser''s own push service, nowhere else');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select lives_ok($$ select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/one', 'BNainaP256dhKeyAAAAAAAAAAAA', 'nainaAuth123') $$,
  'Naina, knowing the address of Kabir''s phone but not its keys');
reset role;
select is(pg_temp.owner_of('https://fcm.googleapis.com/fcm/send/one'), '00000000-0000-4000-8000-000000000202'::uuid, 'does not take it');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select lives_ok($$ select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/one', 'BNainaP256dhKeyAAAAAAAAAAAA', 'kabirAuth123') $$,
  'Naina signs in on the same phone, which presents its keys');
reset role;
select is(pg_temp.owner_of('https://fcm.googleapis.com/fcm/send/one'), '00000000-0000-4000-8000-000000000203'::uuid, 'and the phone moves to her');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select lives_ok($$ select public.remove_push_subscription('https://fcm.googleapis.com/fcm/send/one') $$, 'Kabir turning off a phone that is not his');
reset role;
select is(pg_temp.owner_of('https://fcm.googleapis.com/fcm/send/one'), '00000000-0000-4000-8000-000000000203'::uuid, 'changes nothing');
select pg_temp.as_person('00000000-0000-4000-8000-000000000203');
select lives_ok($$ select public.remove_push_subscription('https://fcm.googleapis.com/fcm/send/one') $$, 'Naina turns hers off');
reset role;
select is(pg_temp.owner_of('https://fcm.googleapis.com/fcm/send/one'), null, 'and it is gone');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/staff', 'BKabirP256dhKeyAAAAAAAAAAAA', 'kabirAuth123') $$, '42501', null,
  'only a member has push notifications');
select throws_ok($$ select * from public.push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'push.seat_ready') $$,
  '42501', null, 'staff cannot read where pushes go');
select throws_ok($$ select * from public.push_subscription $$, '42501', null, 'nor the phones');
reset role;

-- Where each kind goes: Kabir's phone while he wants it; his session reminder whatever he turned off; never elsewhere.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/kabir', 'BKabirP256dhKeyAAAAAAAAAAAA', 'kabirAuth123');
reset role;
select results_eq($$ select endpoint, p256dh, auth from public.push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'push.seat_ready') $$,
  $$ values ('https://fcm.googleapis.com/fcm/send/kabir'::text, 'BKabirP256dhKeyAAAAAAAAAAAA'::text, 'kabirAuth123'::text) $$, 'a seat call goes to Kabir''s phone');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select public.set_my_notification('push.seat_ready', false);
reset role;
select is_empty($$ select * from public.push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'push.seat_ready') $$,
  'not once he turns seat calls off');
select results_eq($$ select endpoint from public.push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', null) $$,
  $$ values ('https://fcm.googleapis.com/fcm/send/kabir'::text) $$, 'while his own session reminder still does');
select is_empty($$ select * from public.push_targets('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000202', null) $$,
  'never at another venue');
select is_empty($$ select * from public.push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', null, gen_random_uuid()) $$,
  'nor a promotion WhatsApp would not offer him (here, none running)');
select lives_ok($$ select public.forget_push_subscription('https://fcm.googleapis.com/fcm/send/kabir') $$, 'a phone whose browser dropped it');
select is(pg_temp.owner_of('https://fcm.googleapis.com/fcm/send/kabir'), null, 'is forgotten');
-- A member keeps five phones at most (their latest), and a push goes to five at most.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/kabir-' || n, 'BKabirP256dhKeyAAAAAAAAAAAA', 'kabirAuth123') from generate_series(1, 6) n;
reset role;
select is((select count(*)::integer from public.push_subscription where member_id = '00000000-0000-4000-8000-000000000202'), 5, 'a member keeps five phones at most');
select is((select count(*)::integer from public.push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', null)), 5,
  'and a push goes to those five');

-- Tournament starting: each member with a place, once, when the clock starts; not again on a pause.
insert into public.tournament_entry (venue_id, tournament_id, member_id, entry_number, status, bust_order, busted_at, table_number, seat_number) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-000000000202', 1, 'busted', 1, now(), null, null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-000000000202', 2, 'seated', null, null, 1, 1),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-000000000203', 1, 'alternate', null, null, null, null),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-000000000204', 1, 'refunded', null, null, null, null);
update public.tournament set clock_started_at = now() where id = '00000000-0000-4000-8000-0000000007a1';
update public.tournament set clock_paused_at = now() where id = '00000000-0000-4000-8000-0000000007a1';
select results_eq(
  $$ select payload ->> 'member_id', payload ->> 'name' from public.outbox_event
     where event_type = 'tournament.starting' and payload ->> 'tournament_id' = '00000000-0000-4000-8000-0000000007a1' order by 1 $$,
  $$ values ('00000000-0000-4000-8000-000000000202'::text, 'RIVR Sunday'::text), ('00000000-0000-4000-8000-000000000203', 'RIVR Sunday') $$,
  'the seated and the alternate are told the tournament is starting, once each; a refunded entry is not');

select * from finish();
rollback;
