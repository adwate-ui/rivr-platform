-- A new venue starts with the daily limit on Bonus by hand (issue 995; the owner, 15 Nov): 10,000 a staff member a club day,
-- as the venues of 10 Nov were given. A practice venue has none, as then. At the club, which the seed makes the same way, an
-- admin adds up to the limit and no more, and the owner hears of the try. 211 is the member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000004a6', 'RIVR Limit', 'limit-test', false, 'RIVR test', 'Test', 'TLM');
select private.bootstrap_venue('00000000-0000-4000-8000-0000000004b6', 'RIVR Limit practice', 'limit-practice', true, 'RIVR test', 'Test', 'TLP');
select is((select value from public.setting where venue_id = '00000000-0000-4000-8000-0000000004a6' and key = 'bonus.daily_staff_cap'),
  '{"chips": 10000}'::jsonb, 'a new venue starts with a daily limit of 10,000');
select is_empty($$ select 1 from public.setting where venue_id = '00000000-0000-4000-8000-0000000004b6' and key = 'bonus.daily_staff_cap' $$,
  'a new practice venue has none');
select is((select count(*)::integer from public.setting where venue_id = '00000000-0000-4000-8000-000000000001' and key = 'bonus.daily_staff_cap'),
  1, 'the club has the limit, once');

-- The club's first admin, by their login.
create temp table admin on commit drop as
select s.user_id from public.staff s
where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.role = 'admin' and s.user_id is not null order by s.user_id limit 1;
grant select on admin to authenticated;
create function pg_temp.as_admin() returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', (select a.user_id from admin a), 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true),
         set_config('role', 'authenticated', true);
$$;
create function pg_temp.give(p_chips integer) returns uuid language sql as $$
  select public.give_bonus_chips('00000000-0000-4000-8000-000000000211', p_chips, 'For the night', gen_random_uuid());
$$;
grant execute on function pg_temp.as_admin(), pg_temp.give(integer) to authenticated;

select pg_temp.as_admin();
select isnt(pg_temp.give(10000), null, 'an admin adds up to the limit');
select is(pg_temp.give(50), null, 'and nothing past it');
reset role;
select is((select count(*)::integer from public.alert where kind = 'bonus.daily_cap' and venue_id = '00000000-0000-4000-8000-000000000001'
           and created_at >= private.tonight_began(now())), 1, 'the owner hears of the try');

select * from finish();
rollback;
