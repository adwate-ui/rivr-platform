-- A member's own session history (#127). Ishaan (211) checks in, sits at Table 3 for three hours and leaves by the
-- door: his session has its table and its time, and no money, since the cage that recorded buy-ins and cash-outs went
-- on 15 Nov. Kunal (216) plays two hours and hides his session. Mihir (213) asked to be told of a tournament.
-- 103 Aditya is the floor manager; 201 Arjun another member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000211'), null, 'Ishaan checks in');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'and sits at Table 3');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'Sessions test'), null,
  'he may leave before his call time');
reset role;
-- Three hours ago, since everything in one transaction happens at one moment.
update public.visit set opened_at = now() - interval '3 hours' where member_id = '00000000-0000-4000-8000-000000000211' and closed_at is null;
update public.seat_session set started_at = now() - interval '3 hours', seated_here_at = now() - interval '3 hours'
where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null;

-- He leaves: the floor ends his seat and the door closes his visit.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.end_seat((select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null), 'left');
select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select results_eq(
  $$ select table_name, played_seconds, buy_in_paise, bonus_paise, cash_out_paise, tds_paise, paid_paise, net_paise
     from public.my_sessions() $$,
  $$ values ('Table 3'::text, 10800::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint) $$,
  'his session: Table 3 for three hours, with no money recorded on a cash session');
select is((select receipt from public.my_sessions()), null, 'and no receipt, with no cage to print one');
select results_eq(
  $$ select month, month_sessions, month_played_seconds, month_net_paise from public.my_sessions() $$,
  $$ select date_trunc('month', (now() - interval '3 hours') at time zone 'Asia/Kolkata' - interval '6 hours')::date, 1, 10800::bigint, 0::bigint $$,
  'and the club month''s totals');
select results_eq($$ select small_blind_paise, big_blind_paise from public.my_sessions() $$,
  $$ select tt.small_blind_paise, tt.big_blind_paise from public.game_table g join public.table_type tt on tt.id = g.table_type_id
     where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3' $$, 'at Table 3''s stakes');
reset role;

-- A visit still open is not history yet.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.check_in_by_phone('00000000-0000-4000-8000-000000000001', '9000000211'), null, 'he comes back');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'and sits again');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.my_sessions()), 1, 'his open visit is not listed');

-- Kunal's session, which he hides below. An earlier visit of his at which he never sat, as the seed gave him until
-- credit went, is made here.
reset role;
select set_config('request.jwt.claims', '', true);
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', now() - interval '3 days', now() - interval '3 days' + interval '5 hours', 'door');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 4, '9000000216'),
  null, 'and sits at Table 3');
select isnt(public.let_leave_early('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', 'Sessions test'), null,
  'he may leave before his call time');
reset role;
update public.visit set opened_at = now() - interval '2 hours' where member_id = '00000000-0000-4000-8000-000000000216' and closed_at is null;
update public.seat_session set started_at = now() - interval '2 hours', seated_here_at = now() - interval '2 hours'
where member_id = '00000000-0000-4000-8000-000000000216' and ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.end_seat((select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000216' and ended_at is null), 'left');
select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is((select count(*)::integer from public.my_sessions()), 1, 'his earlier visits, at which he never sat, are not sessions');
reset role;

-- No one reads another member's sessions: Ishaan's visits, kept before reading as Arjun, whose own policy hides them.
create temp table ishaan_visits as select id from public.visit where member_id = '00000000-0000-4000-8000-000000000211';
grant select on ishaan_visits to authenticated;
select ok((select count(*) from ishaan_visits) >= 1, 'Ishaan has visits to hide');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from public.my_sessions() where visit_id in (select id from ishaan_visits)), 0, 'Arjun does not see Ishaan''s');
reset role;

-- A past tournament the member asked to be told of is in their history (redesign of 15 Nov 2026, issue 969; decision 0630):
-- Mihir asks about Sessions Knockout. Once it has started it is there on its day, with the entries staff typed and no
-- place, time or money, and the month's sessions still count cash sessions alone. Arjun, who did not ask, has none.
insert into public.tournament (id, venue_id, name, starts_at, game, is_published)
values ('00000000-0000-4000-8000-00000000f157', '00000000-0000-4000-8000-000000000001', 'Sessions Knockout', now() + interval '1 hour',
        'No-limit hold''em', true);
insert into public.tournament_interest (venue_id, tournament_id, member_id)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000f157', '00000000-0000-4000-8000-000000000213');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.my_sessions() where kind = 'tournament'), 0, 'a tournament still to come is not in his sessions');
reset role;
update public.tournament set starts_at = now() - interval '1 hour', entries = 58 where id = '00000000-0000-4000-8000-00000000f157';
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq(
  $$ select table_name, kind, place, entrants, played_seconds, buy_in_paise, net_paise from public.my_sessions() where kind = 'tournament' $$,
  $$ values ('Sessions Knockout'::text, 'tournament'::text, null::integer, 58, 0::bigint, 0::bigint, 0::bigint) $$,
  'once it has started it is in his sessions, with its entries and no place, time or money');
select ok((select bool_and(s.month_sessions = (select count(*) from public.my_sessions() c where c.kind = 'cash' and c.month = s.month))
           from public.my_sessions() s), 'and a month''s sessions count cash sessions alone');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from public.my_sessions() where kind = 'tournament'), 0, 'a member who did not ask has no tournament in theirs');
reset role;

-- A member hides a session from their own list (#627): Kunal hides his, and the club still has the visit. Arjun hiding
-- Ishaan's changes only Arjun's list.
create temp table kunal_session as select id from public.visit
where member_id = '00000000-0000-4000-8000-000000000216' and opened_at = now() - interval '2 hours';
grant select on kunal_session to authenticated;
create temp table ishaan_session as select id from public.visit
where member_id = '00000000-0000-4000-8000-000000000211' and opened_at = now() - interval '3 hours';
grant select on ishaan_session to authenticated;
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select lives_ok($$ select public.hide_my_session((select id from kunal_session)) $$, 'Kunal hides his session');
select lives_ok($$ select public.hide_my_session((select id from kunal_session)) $$, 'and hiding it again changes nothing');
select is((select count(*)::integer from public.my_sessions()), 0, 'his list leaves it out');
select throws_ok($$ select public.hide_my_session(null) $$, '22023', null, 'hiding nothing is refused');
reset role;
select is((select hidden_sessions from public.member_preference where member_id = '00000000-0000-4000-8000-000000000216'),
  array[(select id from kunal_session)], 'it is on his list once');
select is((select count(*)::integer from public.visit where id in (select id from kunal_session)), 1, 'and the club keeps the visit');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select throws_ok($$ select public.hide_my_session((select id from ishaan_session)) $$, '22023', null,
  'Arjun cannot hide Ishaan''s session: only one of his own');
select throws_ok($$ select public.hide_my_session(gen_random_uuid()) $$, '22023', null, 'nor any id that is no session of his');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.my_sessions()), 1, 'and Ishaan still sees his session');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.hide_my_session((select id from kunal_session)) $$, '42501', null, 'staff have no sessions to hide');
reset role;
select is(has_function_privilege('anon', 'public.hide_my_session(uuid)', 'execute'), false, 'nobody signed out hides one');

-- A tier without session history reads none.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode)
select m.venue_id, m.tier_id, 'sessions.history', false, 'locked' from public.member m where m.id = '00000000-0000-4000-8000-000000000211';
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is((select count(*)::integer from public.my_sessions()), 0, 'without sessions.history in his tier, he reads none');
select throws_ok($$ select public.hide_my_session((select id from ishaan_session)) $$, '42501', null, 'and hides none (rule 8)');
reset role;

select is(has_function_privilege('anon', 'public.my_sessions()', 'execute'), false, 'nobody signed out reads sessions');

select * from finish();
rollback;
