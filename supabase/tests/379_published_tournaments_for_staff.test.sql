-- Staff see, correct, withdraw and publish again what members are shown (audit 8 Nov, F-027). 103 Aditya runs tournaments,
-- 106 Pema is a dealer, 213 Mihir a member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- The Waitlist badge's count of members not yet marked.
create function pg_temp.unmarked() returns integer language sql as $$
  select coalesce((select waiting from public.staff_queue_counts('00000000-0000-4000-8000-000000000001') where queue = 'tournamentInterest'), 0);
$$;
grant execute on function pg_temp.unmarked() to authenticated;

insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise, is_published, game, stake) values
  ('00000000-0000-4000-8000-0000000c3791', '00000000-0000-4000-8000-000000000001', 'Nobody Asked Cup', now() + interval '2 days', 1000000, true, 'NLH', '50/100'),
  ('00000000-0000-4000-8000-0000000c3792', '00000000-0000-4000-8000-000000000001', 'Asked Cup', now() + interval '3 days', 1000000, true, 'NLH', '50/100'),
  ('00000000-0000-4000-8000-0000000c3793', '00000000-0000-4000-8000-000000000001', 'Draft Cup', now() + interval '3 days', 1000000, false, 'NLH', '50/100'),
  ('00000000-0000-4000-8000-0000000c3794', '00000000-0000-4000-8000-000000000001', 'Last Week Cup', now() - interval '7 days', 1000000, true, 'NLH', '50/100'),
  ('00000000-0000-4000-8000-0000000c3795', '00000000-0000-4000-8000-000000000001', 'Started Cup', now() + interval '1 day', 1000000, true, 'NLH', '50/100');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select lives_ok($$ select public.register_tournament_interest('00000000-0000-4000-8000-0000000c3792') $$, 'Mihir asks about one');
select lives_ok($$ select public.register_tournament_interest('00000000-0000-4000-8000-0000000c3795') $$, 'and about another');
select is_empty($$ select 1 from public.published_tournaments('00000000-0000-4000-8000-000000000001') $$, 'a member reads no list');
reset role;
update public.tournament set starts_at = now() - interval '2 hours' where id = '00000000-0000-4000-8000-0000000c3795';

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select name, is_published, has_started, interested, registered from public.published_tournaments('00000000-0000-4000-8000-000000000001') where name like '%Cup' order by starts_at $$,
  $$ values ('Started Cup'::text, true, true, 1, 0), ('Nobody Asked Cup', true, false, 0, 0), ('Asked Cup', true, false, 1, 0) $$,
  'every upcoming published one, nobody having asked too, and one started within the day; no draft, nor one gone by');

select lives_ok($$ select public.mark_tournament_registered((select interest_id from public.tournament_interest_list('00000000-0000-4000-8000-000000000001') where tournament_name = 'Started Cup')) $$,
  'whoever pays after the start can be marked');
select is((select registered from public.published_tournaments('00000000-0000-4000-8000-000000000001') where name = 'Started Cup'), 1, 'and the card counts them');
select throws_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c3795', 'Late', now() + interval '4 days', 'PLO', '100/200', '') $$, '42501', null, 'one started cannot be changed');
select throws_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c3795') $$, '42501', null, 'nor withdrawn');

select lives_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c3791', 'Renamed Cup', now() + interval '4 days', 'PLO', '100/200', 'Words') $$, 'it can be corrected');
select results_eq($$ select name, game, stake, description from public.tournament where id = '00000000-0000-4000-8000-0000000c3791' $$,
  $$ values ('Renamed Cup'::text, 'PLO'::text, '100/200'::text, 'Words'::text) $$, 'and is');
select throws_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c3791', ' ', now() + interval '4 days', 'PLO', '100/200', '') $$, '22023', null, 'not without a name');
select throws_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c3794', 'Past', now() + interval '4 days', 'PLO', '100/200', '') $$, '42501', null, 'nor one gone by');

-- Withdrawing, and undoing it. The badge counts only those it can act on.
select set_config('test.unmarked', pg_temp.unmarked()::text, true);
select ok(current_setting('test.unmarked')::integer > 0, 'the badge counts Mihir, not yet marked');
select lives_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c3792') $$, 'it can be withdrawn');
select results_eq($$ select name, is_published, has_started, interested from public.published_tournaments('00000000-0000-4000-8000-000000000001') where name = 'Asked Cup' $$,
  $$ values ('Asked Cup'::text, false, false, 1) $$, 'and stays on staff''s list, marked, with who asked');
select is(pg_temp.unmarked(), current_setting('test.unmarked')::integer - 1, 'and the badge no longer counts who asked about it');
select throws_ok($$ select public.mark_tournament_registered((select interest_id from public.tournament_interest_list('00000000-0000-4000-8000-000000000001') where tournament_name = 'Asked Cup')) $$,
  '22023', null, 'nobody can be marked on it, even from a tab left open');
select throws_ok($$ select public.publish_tournament_again('00000000-0000-4000-8000-0000000c3793') $$, '42501', null, 'a draft was never withdrawn');
select throws_ok($$ select public.publish_tournament_again('00000000-0000-4000-8000-0000000c3791') $$, '42501', null, 'nor one still published');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is_empty($$ select 1 from public.my_upcoming_tournaments() where name = 'Asked Cup' $$, 'and members no longer see it');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.publish_tournament_again('00000000-0000-4000-8000-0000000c3792') $$, '42501', null, 'a dealer publishes nothing again');
select throws_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c3791') $$, '42501', null, 'a dealer withdraws nothing');
select throws_ok($$ select public.edit_published_tournament('00000000-0000-4000-8000-0000000c3791', 'X', now() + interval '4 days', 'PLO', '100/200', '') $$, '42501', null, 'nor edits');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.publish_tournament_again('00000000-0000-4000-8000-0000000c3792') $$, 'it can be published again');
select is(pg_temp.unmarked(), current_setting('test.unmarked')::integer, 'and the badge counts who asked once more');
select results_eq($$ select is_published, withdrawn_at from public.tournament where id = '00000000-0000-4000-8000-0000000c3792' $$,
  $$ values (true, null::timestamptz) $$, 'no longer withdrawn');
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select isnt_empty($$ select 1 from public.my_upcoming_tournaments() where name = 'Asked Cup' $$, 'and members see it again');

-- Withdrawn and gone by, there is nothing left to publish again.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.withdraw_tournament('00000000-0000-4000-8000-0000000c3791') $$, 'another is withdrawn');
reset role;
update public.tournament set starts_at = now() - interval '1 hour' where id = '00000000-0000-4000-8000-0000000c3791';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.published_tournaments('00000000-0000-4000-8000-000000000001') where name = 'Renamed Cup' $$, 'and once its start has passed it leaves the list');
select throws_ok($$ select public.publish_tournament_again('00000000-0000-4000-8000-0000000c3791') $$, '42501', null, 'and cannot be published again');

-- Staff and members read one list: Home shows its first twenty, and staff all of it.
reset role;
insert into public.tournament (venue_id, name, starts_at, buy_in_paise, is_published, game, stake)
  select '00000000-0000-4000-8000-000000000001', 'Bulk ' || n, now() + make_interval(hours => n), 1000000, true, 'NLH', '50/100' from generate_series(1, 25) n;
select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select count(*)::integer from public.my_upcoming_tournaments()), 20, 'Home shows twenty at most');
select set_config('test.home', (select string_agg(tournament_id::text, ',' order by starts_at) from public.my_upcoming_tournaments()), true);
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select ok((select count(*)::integer from public.published_tournaments('00000000-0000-4000-8000-000000000001') where name like 'Bulk %') = 25, 'staff see every one, past the twentieth');
select is((select string_agg(s.tournament_id::text, ',' order by s.starts_at)
           from (select tournament_id, starts_at from public.published_tournaments('00000000-0000-4000-8000-000000000001') where is_published and not has_started order by starts_at limit 20) s),
  current_setting('test.home'), 'and Home''s twenty are the first of them');

reset role;
select ok(not has_function_privilege('anon', 'public.published_tournaments(uuid)', 'execute'), 'nobody signed out reads the list');
select ok(not has_function_privilege('anon', 'public.publish_tournament_again(uuid)', 'execute'), 'nor publishes one again');
select ok(not has_function_privilege('authenticated', 'private.upcoming_published_tournaments(uuid)', 'execute'), 'the one list is read only through those two');

select * from finish();
rollback;
