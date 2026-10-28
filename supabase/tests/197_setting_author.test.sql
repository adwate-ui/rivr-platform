-- Settings' history names who set each value (#604): someone signed in is always the author, whatever the request
-- says. 101 Vikram is a super admin, 103 Aditya an admin who manages settings.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
-- The club's staff ids for the two, and one from the practice venue, as ids a forger might give.
create temp table who as
  select s.user_id::text as person, s.id as staff_id from public.staff s
  where s.venue_id = '00000000-0000-4000-8000-000000000001'
    and s.user_id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000103')
  union all
  (select 'practice', s.id from public.staff s where s.venue_id = '00000000-0000-4000-8000-000000000002' limit 1);
grant select on who to authenticated;
select is((select count(*) from who), 3::bigint, 'the seed has both, and staff at the practice venue');

create function pg_temp.hold(p_days integer, p_reason text, p_author uuid) returns void language sql as $$
  insert into public.setting (venue_id, key, value, effective_from, reason, created_by_staff_id)
  values ('00000000-0000-4000-8000-000000000001', 'waitlist.hold_minutes', '{"minutes": 12}', now() + make_interval(days => p_days),
          p_reason, p_author);
$$;
grant execute on function pg_temp.hold(integer, text, uuid) to authenticated;

-- 1. Aditya names Vikram as the author, then gives none, then a practice venue's staff id: each is his own.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select pg_temp.hold(1, 'Owner asked', (select staff_id from who where person = '00000000-0000-4000-8000-000000000101')) $$,
  'an admin may send an author');
select lives_ok($$ select pg_temp.hold(2, 'No author given', null) $$, 'or none');
select lives_ok($$ select pg_temp.hold(3, 'Another venue''s staff', (select staff_id from who where person = 'practice')) $$,
  'or another venue''s staff, without the foreign key telling him it is one');
reset role;
select set_config('request.jwt.claims', '', true);
select results_eq(
  $$ select reason, created_by_staff_id from public.setting where key = 'waitlist.hold_minutes' and reason in ('Owner asked', 'No author given', 'Another venue''s staff') order by effective_from $$,
  $$ select r, (select staff_id from who where person = '00000000-0000-4000-8000-000000000103')
     from unnest(array['Owner asked', 'No author given', 'Another venue''s staff']) with ordinality as t(r, n) order by n $$,
  'and each change is his, whatever he sent');

-- 2. Vikram's change is his.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select lives_ok($$ select pg_temp.hold(4, 'Super admin', null) $$, 'a super admin sets one');
reset role;
select set_config('request.jwt.claims', '', true);
select is((select created_by_staff_id from public.setting where reason = 'Super admin'),
  (select staff_id from who where person = '00000000-0000-4000-8000-000000000101'), 'and is its author');

-- 3. The database itself (a migration, the seed) has no one signed in and keeps what it writes.
select lives_ok($$ select pg_temp.hold(5, 'Seeded', (select staff_id from who where person = '00000000-0000-4000-8000-000000000101')) $$,
  'the database writes one with an author');
select is((select created_by_staff_id from public.setting where reason = 'Seeded'),
  (select staff_id from who where person = '00000000-0000-4000-8000-000000000101'), 'and keeps it');

select * from finish();
rollback;
