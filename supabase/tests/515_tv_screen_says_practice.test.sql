-- A TV reads whether its venue is the practice one (decision 0673): the club's says no, the practice venue's says yes, and
-- the columns an older TV build reads are all still there.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_tv(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_tv(uuid) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e515', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000515'),
  ('00000000-0000-4000-8000-00000000e516', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000000516');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d515', '00000000-0000-4000-8000-000000000001', 'tv', 'Club TV', '00000000-0000-4000-8000-00000000e515'),
  ('00000000-0000-4000-8000-00000000d516', '00000000-0000-4000-8000-000000000002', 'tv', 'Practice TV', '00000000-0000-4000-8000-00000000e516');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d515', '00000000-0000-4000-8000-000000000001', 'waitlist'),
  ('00000000-0000-4000-8000-00000000d516', '00000000-0000-4000-8000-000000000002', 'waitlist');

select pg_temp.as_tv('00000000-0000-4000-8000-00000000e515');
select results_eq($$ select name, is_practice from public.my_tv_screen() $$, $$ values ('Club TV', false) $$,
  'the club''s TV reads that its venue is not the practice one');
select results_eq($$ select mode, rotation from public.my_tv_screen() $$, $$ values ('waitlist'::public.tv_mode, '{}'::public.tv_mode[]) $$,
  'and still reads the columns an older TV build reads');

select pg_temp.as_tv('00000000-0000-4000-8000-00000000e516');
select results_eq($$ select name, is_practice from public.my_tv_screen() $$, $$ values ('Practice TV', true) $$,
  'the practice venue''s TV reads that it is');

reset role;
select ok(not has_function_privilege('anon', 'public.my_tv_screen()', 'execute'), 'and no one signed out reads it');

select * from finish();
rollback;
