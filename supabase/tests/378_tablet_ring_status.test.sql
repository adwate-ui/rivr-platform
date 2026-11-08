-- The dealer's ring (audit 8 Nov, F-189): a tablet reads who is leaving and its table's blinds. As in 050: Tablet A at Table 3, where
-- the floor (103) seats Ishaan (211) at seat 9.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.tablet_assignment;

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e378', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000003781');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d378', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet A', '00000000-0000-4000-8000-00000000e378');
insert into public.tablet_assignment (device_id, venue_id, table_id)
select '00000000-0000-4000-8000-00000000d378', '00000000-0000-4000-8000-000000000001', g.id from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3';

create temp table table_three as
select g.id, tt.small_blind_paise, tt.big_blind_paise from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3';
grant select on table_three to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from table_three), 9, '9000000211'), null, 'the floor seats Ishaan at seat 9');

select pg_temp.as_person('00000000-0000-4000-8000-00000000e378');
select is((select leaving_at from public.tablet_seats() where seat = 9), null, 'not leaving yet');
select is((select count(distinct (small_blind_paise, big_blind_paise))::integer from public.tablet_seats()), 1, 'every seat carries the same blinds, the open ones too');
select results_eq($$ select small_blind_paise, big_blind_paise from public.tablet_seats() where seat = 1 $$,
  $$ select small_blind_paise, big_blind_paise from table_three $$, 'the blinds of the table''s type');

reset role;
update public.seat_session set leaving_at = now() where table_id = (select id from table_three) and seat = 9 and ended_at is null;
select pg_temp.as_person('00000000-0000-4000-8000-00000000e378');
select isnt((select leaving_at from public.tablet_seats() where seat = 9), null, 'the tablet sees that he is leaving');

reset role;
select ok(not has_function_privilege('anon', 'public.tablet_seats()', 'execute'), 'nobody signed out reads the seats');

select * from finish();
rollback;
