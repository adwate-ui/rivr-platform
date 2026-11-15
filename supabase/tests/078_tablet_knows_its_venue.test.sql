-- A tablet says whether it stands in the practice venue. The certification quizzes this file was written for went on
-- 15 Nov; this is what it held about a thing that stays.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated, anon;

-- The tablet knows whether it stands in the practice venue.
reset role;
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000001'),
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000002');
insert into public.device (venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-000000000002', 'dealer_tablet', 'Practice tablet', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Club tablet', '00000000-0000-4000-8000-00000000e002');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e001');
select results_eq($$ select name, is_practice from public.my_device() $$, $$ values ('Practice tablet'::text, true) $$,
  'a tablet in the practice venue says so');
select pg_temp.as_person('00000000-0000-4000-8000-00000000e002');
select results_eq($$ select name, is_practice from public.my_device() $$, $$ values ('Club tablet'::text, false) $$, 'a club tablet does not');

select * from finish();
rollback;
