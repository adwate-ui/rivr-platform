-- Tournament interest (#636): the app lists the club's upcoming published tournaments, with no buy-in; a member with
-- tournaments.register registers interest, once; the floor (waitlist.manage: 103 Aditya, an admin) reads who asked and
-- marks them registered once they paid at the venue. 213 Mihir and 216 Kunal are members; 106 Pema a dealer.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise, is_published) values
  ('00000000-0000-4000-8000-0000000c2041', '00000000-0000-4000-8000-000000000001', 'Interest Cup', now() + interval '2 days', 1000000, true),
  ('00000000-0000-4000-8000-0000000c2042', '00000000-0000-4000-8000-000000000001', 'Draft Cup', now() + interval '3 days', 1000000, false),
  ('00000000-0000-4000-8000-0000000c2043', '00000000-0000-4000-8000-000000000001', 'Last Week Cup', now() - interval '7 days', 1000000, true);

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select name, standing from public.my_upcoming_tournaments() where name like '%Cup' $$,
  $$ values ('Interest Cup'::text, 'none'::text) $$, 'Mihir sees the upcoming published tournament, not a draft nor one gone by');
select throws_ok($$ select public.register_tournament_interest('00000000-0000-4000-8000-0000000c2042') $$, '22023', null, 'nor registers for a draft');
select lives_ok($$ select public.register_tournament_interest('00000000-0000-4000-8000-0000000c2041') $$, 'he registers interest');
select lives_ok($$ select public.register_tournament_interest('00000000-0000-4000-8000-0000000c2041') $$, 'and again changes nothing');
select is((select standing from public.my_upcoming_tournaments() where name = 'Interest Cup'), 'interested', 'he sees it as interested');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is((select count(*)::integer from public.tournament_interest_list('00000000-0000-4000-8000-000000000001')), 0, 'a dealer reads no list');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
create temp table interest as
select interest_id from public.tournament_interest_list('00000000-0000-4000-8000-000000000001') where full_name = 'Mihir Shah' and tournament_name = 'Interest Cup';
select is((select count(*)::integer from interest), 1, 'the floor reads Mihir''s interest');
select lives_ok($$ select public.mark_tournament_registered((select interest_id from interest)) $$, 'and marks him registered once he paid');
select throws_ok($$ select public.mark_tournament_registered((select interest_id from interest)) $$, '22023', null, 'once');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select is((select standing from public.my_upcoming_tournaments() where name = 'Interest Cup'), 'registered', 'Mihir sees himself registered');
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is((select count(*)::integer from public.tournament_interest), 0, 'Kunal reads no one else''s interest');
reset role;

-- A tier without tournament registration sees none, and registers none.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode)
select m.venue_id, m.tier_id, 'tournaments.register', false, 'locked' from public.member m where m.id = '00000000-0000-4000-8000-000000000216';
select pg_temp.as_person('00000000-0000-4000-8000-000000000216');
select is((select count(*)::integer from public.my_upcoming_tournaments()), 0, 'without tournaments.register he sees none');
select throws_ok($$ select public.register_tournament_interest('00000000-0000-4000-8000-0000000c2041') $$, '42501', null, 'and registers none');
reset role;

-- With tournament registration switched off, nobody registers interest (212 Vihaan's tier has it) and the floor marks
-- nobody registered.
insert into public.control_state (venue_id, level, feature, reason) values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'tournament_registration', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select throws_ok($$ select public.register_tournament_interest('00000000-0000-4000-8000-0000000c2041') $$, 'RVKIL', null,
  'with registration switched off, no interest is registered');
reset role;
insert into public.tournament_interest (venue_id, tournament_id, member_id)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c2041', '00000000-0000-4000-8000-000000000216');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.mark_tournament_registered((select i.id from public.tournament_interest i
                    where i.member_id = '00000000-0000-4000-8000-000000000216')) $$, 'RVKIL', null, 'and the floor marks nobody registered');
reset role;

select is(has_function_privilege('anon', 'public.register_tournament_interest(uuid)', 'execute'), false, 'nobody signed out registers');

select * from finish();
rollback;
