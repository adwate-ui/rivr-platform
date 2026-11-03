-- Undo for Mark registered (console v3): staff who manage tournaments (103 Aditya, an admin) take back a registration they
-- marked within ten minutes, and no later; a dealer (106 Pema) takes back none. 213 Mihir is the member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise, is_published) values
  ('00000000-0000-4000-8000-0000000c2961', '00000000-0000-4000-8000-000000000001', 'Undo Cup', now() + interval '2 days', 1000000, true);
insert into public.tournament_interest (id, venue_id, tournament_id, member_id) values
  ('00000000-0000-4000-8000-0000000c2962', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000c2961',
   '00000000-0000-4000-8000-000000000213');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.unmark_tournament_registered('00000000-0000-4000-8000-0000000c2962') $$, '22023', null,
  'a registration not marked is not taken back');
select lives_ok($$ select public.mark_tournament_registered('00000000-0000-4000-8000-0000000c2962') $$, 'the floor marks Mihir registered');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select public.unmark_tournament_registered('00000000-0000-4000-8000-0000000c2962') $$, '42501', null,
  'a dealer takes back no registration');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.unmark_tournament_registered('00000000-0000-4000-8000-0000000c2962') $$, 'Undo takes it back');
reset role;
select is((select registered_at from public.tournament_interest where id = '00000000-0000-4000-8000-0000000c2962'), null,
  'so Mihir is interested again, not registered');
select is((select registered_by_staff_id from public.tournament_interest where id = '00000000-0000-4000-8000-0000000c2962'), null,
  'and nobody is named as having registered him');

-- Marked again, eleven minutes ago: too late for the toast's Undo.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.mark_tournament_registered('00000000-0000-4000-8000-0000000c2962') $$, 'the floor marks him again');
reset role;
update public.tournament_interest set registered_at = now() - interval '11 minutes' where id = '00000000-0000-4000-8000-0000000c2962';
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.unmark_tournament_registered('00000000-0000-4000-8000-0000000c2962') $$, '22023', null,
  'a registration marked more than ten minutes ago stays');
reset role;

select is(has_function_privilege('anon', 'public.unmark_tournament_registered(uuid)', 'execute'), false, 'nobody signed out takes one back');

select * from finish();
rollback;
