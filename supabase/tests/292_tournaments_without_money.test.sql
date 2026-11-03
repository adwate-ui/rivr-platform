-- Tournaments without money (#800; decision 0441): staff who manage tournaments (103 Aditya, an admin) publish an upcoming
-- one with its name, start, game and stake as text and a description, and no buy-in or prize. Members see it as before
-- (213 Mihir, who registers interest), and so does the website, without a buy-in; a practice venue's never reaches it.
-- 106 Pema, a dealer, and another venue's admin publish nothing here.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into auth.users (instance_id, id, aud, role, phone, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', '919000000999', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000ea', 'authenticated', 'authenticated', '919000000998', now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2', 'Elsewhere Admin', 'Floor manager', 'admin'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000ea', 'Practice admin', 'Admin', 'admin');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.publish(p_venue uuid, p_name text, p_starts_at timestamptz, p_game text, p_stake text, p_description text)
returns uuid language sql as $$
  select public.publish_tournament(p_venue, p_name, p_starts_at, p_game, p_stake, p_description);
$$;
grant execute on function pg_temp.publish(uuid, text, timestamptz, text, text, text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
insert into ids select 'cup', pg_temp.publish('00000000-0000-4000-8000-000000000001', ' Diwali Deepstack ', now() + interval '3 days',
  ' No-limit hold''em ', '25,000 chips', 'Twenty-minute levels. Late registration to level 6.');
select results_eq(
  $$ select name, game, stake, description, buy_in_paise, guarantee_paise, is_published from public.tournament where id = (select id from ids where name = 'cup') $$,
  $$ values ('Diwali Deepstack'::text, 'No-limit hold''em'::text, '25,000 chips'::text, 'Twenty-minute levels. Late registration to level 6.'::text,
             null::bigint, null::bigint, true) $$,
  'the admin publishes a tournament with its game and stake as text, and no money');
insert into ids select 'plain', pg_temp.publish('00000000-0000-4000-8000-000000000001', 'Sunday Turbo', now() + interval '4 days', 'PLO', '10,000 chips', '  ');
select is((select description from public.tournament where id = (select id from ids where name = 'plain')), null, 'a description is not needed');

select throws_ok($$ select pg_temp.publish('00000000-0000-4000-8000-000000000001', '', now() + interval '1 day', 'PLO', '10,000 chips', null) $$,
  '22023', null, 'a tournament needs a name');
select throws_ok($$ select pg_temp.publish('00000000-0000-4000-8000-000000000001', repeat('x', 81), now() + interval '1 day', 'PLO', '10,000 chips', null) $$,
  '22023', null, 'of 80 characters at most');
select throws_ok($$ select pg_temp.publish('00000000-0000-4000-8000-000000000001', 'Yesterday Cup', now() - interval '1 day', 'PLO', '10,000 chips', null) $$,
  '22023', null, 'a start still to come');
select throws_ok($$ select pg_temp.publish('00000000-0000-4000-8000-000000000001', 'Cup', now() + interval '1 day', ' ', '10,000 chips', null) $$,
  '22023', null, 'a game');
select throws_ok($$ select pg_temp.publish('00000000-0000-4000-8000-000000000001', 'Cup', now() + interval '1 day', 'PLO', repeat('x', 41), null) $$,
  '22023', null, 'and a stake of 40 characters at most');
select throws_ok($$ select pg_temp.publish('00000000-0000-4000-8000-000000000001', 'Cup', now() + interval '1 day', 'PLO', '10,000 chips', repeat('x', 501)) $$,
  '22023', null, 'and a description of 500 at most');
reset role;

select throws_ok($$ insert into public.tournament (venue_id, name, starts_at, is_published)
                    values ('00000000-0000-4000-8000-000000000001', 'Nothing Cup', now() + interval '1 day', true) $$,
  '23514', null, 'a tournament has a buy-in, or its game and stake');
select throws_ok($$ update public.tournament set levels = '[]'::jsonb where name = 'Diwali Deepstack' $$,
  '23514', null, 'and one without a buy-in has no blind levels, so it never runs a clock or sells an entry');

select pg_temp.as_person('00000000-0000-4000-8000-000000000213');
select results_eq($$ select name, standing from public.my_upcoming_tournaments() where name in ('Diwali Deepstack', 'Sunday Turbo') order by starts_at $$,
  $$ values ('Diwali Deepstack'::text, 'none'::text), ('Sunday Turbo'::text, 'none'::text) $$, 'Mihir sees both in the app, as before');
select lives_ok($$ select public.register_tournament_interest((select id from ids where name = 'cup')) $$, 'and registers interest in one');
reset role;

set local role anon;
select results_eq($$ select name, buy_in_paise, guarantee_paise from public.public_tournament_calendar where name = 'Diwali Deepstack' $$,
  $$ values ('Diwali Deepstack'::text, null::bigint, null::bigint) $$, 'the website''s calendar shows it, with no buy-in');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-0000000000ea');
select isnt(pg_temp.publish('00000000-0000-4000-8000-000000000002', 'Practice Cup', now() + interval '2 days', 'PLO', '10,000 chips', null), null,
  'the practice venue''s admin publishes one for practice');
reset role;
set local role anon;
select is((select count(*)::integer from public.public_tournament_calendar where name = 'Practice Cup'), 0, 'which never reaches the website');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select throws_ok($$ select pg_temp.publish('00000000-0000-4000-8000-000000000001', 'Dealer Cup', now() + interval '1 day', 'PLO', '10,000 chips', null) $$,
  '42501', null, 'a dealer publishes none');
select pg_temp.as_person('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select pg_temp.publish('00000000-0000-4000-8000-000000000001', 'Elsewhere Cup', now() + interval '1 day', 'PLO', '10,000 chips', null) $$,
  '42501', null, 'nor does another venue''s admin');
reset role;

insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Inspection');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select pg_temp.publish('00000000-0000-4000-8000-000000000001', 'Frozen Cup', now() + interval '1 day', 'PLO', '10,000 chips', null) $$,
  'RVFRZ', null, 'nothing is published while the venue is frozen');
reset role;

select * from finish();
rollback;
