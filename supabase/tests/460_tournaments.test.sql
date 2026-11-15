-- Tournaments, interest only (redesign of 15 Nov 2026, issue 969; decision 0630). Aditya (103), an admin, creates one with a
-- name, a start and a game. Mihir (213), Kunal (216), Vihaan (212), 214 and Neel (217) ask to be told; Kunal turns his
-- Tournaments switch off, 214 is on a break and Neel has been erased. Aditya sends the notification, once: Mihir and Vihaan
-- get a notice each, and the list says 2. Started, a tournament takes its entries. Withdrawn, those who hear of tournaments
-- are told. Sana (104), a cashier, and Pema (106), a dealer, do none of it. The old module is gone.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- A tournament of this test by its name, read as the database's owner.
create function pg_temp.named(p_name text) returns uuid language sql security definer as $$ select id from public.tournament where name = p_name; $$;
grant execute on function pg_temp.named(text) to authenticated;
-- Who was told this of a tournament.
create function pg_temp.told(p_name text, p_notice text) returns setof text language sql as $$
  select e.payload ->> 'member_id' from public.outbox_event e
  where e.event_type = 'member.notice' and e.payload ->> 'tournament_id' = pg_temp.named(p_name)::text and e.payload ->> 'notice' = p_notice order by 1;
$$;

-- ---------------------------------------------------------------------------------------------------
-- What went.
select hasnt_table('public', 'tournament_entry', 'no entries are kept');
select hasnt_table('public', 'tournament_purchase', 'no purchases');
select hasnt_table('public', 'tournament_payout', 'no payouts');
select hasnt_table('public', 'tournament_ticket', 'no tickets');
select hasnt_table('public', 'tournament_template', 'no templates');
select hasnt_table('public', 'blind_structure', 'no blind structures');
select columns_are('public', 'tournament', array['id', 'venue_id', 'name', 'starts_at', 'is_published', 'created_at', 'updated_at', 'game', 'withdrawn_at',
  'notified_at', 'notified_count', 'notified_by_staff_id', 'entries'], 'a tournament is a name, a start, a game, its notification and its entries');
select columns_are('public', 'tournament_interest', array['id', 'venue_id', 'tournament_id', 'member_id', 'created_at', 'updated_at'],
  'and interest in it is who asked and when: nobody is registered');
select is_empty($$ select 1 from cron.job where jobname = 'tournament-ticket-lapse' $$, 'the ticket-lapse job is gone');
select is_empty($$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname in ('public', 'private')
                     and p.proname in ('lapse_tournament_tickets', 'cash_limit_hit', 'aml_cash_in', 'assert_cash_within_limits', 'enforce_cash_limits',
                                       'tournament_clock_at', 'blind_levels_problem', 'mark_tournament_registered', 'edit_published_tournament') $$,
  'with the ticket lapse, the cash limits, the clock, and registering and editing');
select is_empty($$ select 1 from private.member_export_columns() where table_name in ('tournament_entry', 'tournament_purchase', 'tournament_payout', 'tournament_ticket')
                   or column_name in ('registered_at', 'registered_by_staff_id') $$, 'and a member''s export lists none of their columns');

-- ---------------------------------------------------------------------------------------------------
-- Creating one: tournaments.manage, with a name, a start to come and a game.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.publish_tournament('00000000-0000-4000-8000-000000000001', 'Cashier Cup', now() + interval '2 days', 'No-limit hold''em') $$,
  '42501', null, 'a cashier creates none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.publish_tournament('00000000-0000-4000-8000-000000000001', '  Test Deepstack ', now() + interval '2 days', 'No-limit hold''em') $$,
  'an admin creates one');
select lives_ok($$ select public.publish_tournament('00000000-0000-4000-8000-000000000001', 'Quiet Cup', now() + interval '3 days', 'Pot-limit Omaha') $$, 'and another');
select throws_ok($$ select public.publish_tournament('00000000-0000-4000-8000-000000000001', ' ', now() + interval '2 days', 'No-limit hold''em') $$,
  '22023', null, 'not without a name');
select throws_ok($$ select public.publish_tournament('00000000-0000-4000-8000-000000000001', 'Past Cup', now() - interval '1 minute', 'No-limit hold''em') $$,
  '22023', null, 'nor with a start gone by');
select throws_ok($$ select public.publish_tournament('00000000-0000-4000-8000-000000000001', 'Gameless Cup', now() + interval '2 days', ' ') $$,
  '22023', null, 'nor without a game');
select results_eq($$ select name, game, is_past, interested, notified, entries from public.venue_tournaments('00000000-0000-4000-8000-000000000001')
                     where name in ('Test Deepstack', 'Quiet Cup') order by starts_at $$,
  $$ values ('Test Deepstack'::text, 'No-limit hold''em'::text, false, 0, null::integer, null::integer), ('Quiet Cup', 'Pot-limit Omaha', false, 0, null, null) $$,
  'the list has both to come, with nobody asking yet and nothing sent');
select ok((select bool_or(is_past) from public.venue_tournaments('00000000-0000-4000-8000-000000000001')), 'and the seed''s past one');
reset role;

-- ---------------------------------------------------------------------------------------------------
-- Members ask to be told.
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select name, standing from public.my_upcoming_tournaments() where name = 'Test Deepstack' $$,
  $$ values ('Test Deepstack'::text, 'none'::text) $$, 'Mihir sees it on Home');
select lives_ok($$ select public.register_tournament_interest(pg_temp.named('Test Deepstack')) $$, 'he asks to be told');
select lives_ok($$ select public.register_tournament_interest(pg_temp.named('Test Deepstack')) $$, 'and again changes nothing');
select is((select standing from public.my_upcoming_tournaments() where name = 'Test Deepstack'), 'interested', 'he sees that he asked');
select is((select count(*)::integer from public.tournament_interest), 1, 'and reads his own interest alone');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select lives_ok($$ select public.register_tournament_interest(pg_temp.named('Test Deepstack')) $$, 'Kunal asks');
select lives_ok($$ select public.set_my_notification('push.tournament_starting', false) $$, 'then turns his Tournaments switch off');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.register_tournament_interest(pg_temp.named('Test Deepstack')) $$, 'Vihaan asks');
select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select throws_ok($$ select public.register_tournament_interest(pg_temp.named('Test Deepstack')) $$, '22023', null, 'a practice member asks about none of the club''s');
reset role;
-- 214 asked and is now on a break; Neel asked and has been erased.
insert into public.tournament_interest (venue_id, tournament_id, member_id)
select '00000000-0000-4000-8000-000000000001', pg_temp.named('Test Deepstack'), m.id
from public.member m where m.id in ('00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-000000000217');
insert into public.self_exclusion (venue_id, member_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', now() - interval '1 day', now() + interval '7 days');
update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member' where id = '00000000-0000-4000-8000-000000000217';

-- ---------------------------------------------------------------------------------------------------
-- Who asked, and the notification, once.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from public.venue_tournaments('00000000-0000-4000-8000-000000000001')), 0, 'a cashier reads no list');
select is((select count(*)::integer from public.tournament_interested(pg_temp.named('Test Deepstack'))), 0, 'nor who asked');
select throws_ok($$ select public.notify_tournament(pg_temp.named('Test Deepstack')) $$, '42501', null, 'and notifies nobody');
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.notify_tournament(pg_temp.named('Test Deepstack')) $$, '42501', null, 'nor does a dealer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select interested from public.venue_tournaments('00000000-0000-4000-8000-000000000001') where name = 'Test Deepstack'), 5, 'the admin sees five asked');
select set_eq($$ select member_id from public.tournament_interested(pg_temp.named('Test Deepstack')) $$,
  $$ values ('00000000-0000-4000-8000-000000000212'::uuid), ('00000000-0000-4000-8000-000000000213'), ('00000000-0000-4000-8000-000000000214'),
            ('00000000-0000-4000-8000-000000000216'), ('00000000-0000-4000-8000-000000000217') $$, 'and who');
select throws_ok($$ select public.notify_tournament(pg_temp.named('Quiet Cup')) $$, 'RVNOB', null, 'with nobody to tell, nothing is sent');
select is((select notified from public.venue_tournaments('00000000-0000-4000-8000-000000000001') where name = 'Quiet Cup'), null, 'and the one send is kept');
select is(public.notify_tournament(pg_temp.named('Test Deepstack')), 2, 'Notify tells two');
select throws_ok($$ select public.notify_tournament(pg_temp.named('Test Deepstack')) $$, '22023', null, 'once');
select results_eq($$ select notified, notified_at is not null from public.venue_tournaments('00000000-0000-4000-8000-000000000001') where name = 'Test Deepstack' $$,
  $$ values (2, true) $$, 'the list shows how many were notified');
reset role;
select results_eq($$ select * from pg_temp.told('Test Deepstack', 'tournament_starts') $$,
  $$ values ('00000000-0000-4000-8000-000000000212'::text), ('00000000-0000-4000-8000-000000000213') $$,
  'Mihir and Vihaan are told: not Kunal, whose switch is off, nor a member on a break, nor one erased');
select ok((select bool_and((e.payload -> 'params' ->> 0) = 'Test Deepstack'
                           and (e.payload -> 'params' ->> 1)::timestamptz = (select starts_at from public.tournament where name = 'Test Deepstack'))
           from public.outbox_event e where e.event_type = 'member.notice' and e.payload ->> 'notice' = 'tournament_starts'
             and e.payload ->> 'tournament_id' = pg_temp.named('Test Deepstack')::text), 'of its name and start');
select is((select s.user_id from public.tournament t join public.staff s on s.id = t.notified_by_staff_id where t.name = 'Test Deepstack'),
  '00000000-0000-4000-8000-000000000103'::uuid, 'and the record says who sent it');

-- ---------------------------------------------------------------------------------------------------
-- Withdrawn, it leaves both lists, and those who hear of tournaments are told.
insert into public.tournament_interest (venue_id, tournament_id, member_id)
select '00000000-0000-4000-8000-000000000001', pg_temp.named('Quiet Cup'), m.id
from public.member m where m.id in ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000216');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.withdraw_tournament(pg_temp.named('Quiet Cup')) $$, 'the admin cancels Quiet Cup');
select is_empty($$ select 1 from public.venue_tournaments('00000000-0000-4000-8000-000000000001') where name = 'Quiet Cup' $$, 'it leaves the list');
reset role;
select results_eq($$ select * from pg_temp.told('Quiet Cup', 'tournament_withdrawn') $$, $$ values ('00000000-0000-4000-8000-000000000213'::text) $$,
  'Mihir is told; Kunal, whose switch is off, is not');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select 1 from public.my_upcoming_tournaments() where name = 'Quiet Cup' $$, 'and it leaves Home');
reset role;

-- ---------------------------------------------------------------------------------------------------
-- Started, it is past: its entries are typed, and it is notified no more.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.set_tournament_entries(pg_temp.named('Test Deepstack'), 58) $$, '42501', null, 'entries are not typed before it starts');
reset role;
insert into public.tournament (venue_id, name, starts_at, game, is_published)
values ('00000000-0000-4000-8000-000000000001', 'Started Cup', now() - interval '2 hours', 'No-limit hold''em', true);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.set_tournament_entries(pg_temp.named('Started Cup'), 58) $$, 'the admin types a started one''s entries');
select throws_ok($$ select public.set_tournament_entries(pg_temp.named('Started Cup'), -1) $$, '22023', null, 'never below nothing');
select results_eq($$ select is_past, entries from public.venue_tournaments('00000000-0000-4000-8000-000000000001') where name = 'Started Cup' $$,
  $$ values (true, 58) $$, 'and the past list has them');
select throws_ok($$ select public.notify_tournament(pg_temp.named('Started Cup')) $$, '22023', null, 'a started one is notified no more');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.set_tournament_entries(pg_temp.named('Started Cup'), 60) $$, '42501', null, 'a cashier types none');
reset role;

-- ---------------------------------------------------------------------------------------------------
-- A tier without tournaments sees none and asks about none.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode)
select m.venue_id, m.tier_id, 'tournaments.register', false, 'locked' from public.member m where m.id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.my_upcoming_tournaments()), 0, 'without the feature a member sees none');
select throws_ok($$ select public.register_tournament_interest(pg_temp.named('Test Deepstack')) $$, '42501', null, 'and asks about none');
reset role;

select ok(not has_function_privilege('anon', 'public.publish_tournament(uuid, text, timestamptz, text)', 'execute')
          and not has_function_privilege('anon', 'public.venue_tournaments(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.tournament_interested(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.notify_tournament(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.set_tournament_entries(uuid, integer)', 'execute')
          and not has_function_privilege('anon', 'public.register_tournament_interest(uuid)', 'execute'), 'nobody signed out does any of it');
select ok(not has_function_privilege('authenticated', 'private.hears_of_tournaments(uuid)', 'execute'), 'and who hears of tournaments is not asked from outside');

select * from finish();
rollback;
