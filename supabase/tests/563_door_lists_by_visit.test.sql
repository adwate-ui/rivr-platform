-- The door's lists hold each row by its visit (the e2e of the pull request): Mihir (213) checks in, out and in again, so
-- In the room has his open visit's row alone, Left his first, and everyone (no list) both. Kunal (216) came and went
-- earlier and is on a list again from the app, not in: Left has his visit, Expected his wait. 103 Aditya is an admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.door(p_list text) returns table (member_id uuid, visit_id uuid, checked_out_at timestamptz) language sql as $$
  select d.member_id, d.visit_id, d.checked_out_at
  from public.door_page('00000000-0000-4000-8000-000000000001',
    jsonb_build_object('page_size', 1000, 'scope', case when p_list is null then '{}'::jsonb else jsonb_build_object('list', p_list) end)) d
  where d.member_id in ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000216');
$$;
grant execute on function pg_temp.door(text) to authenticated;
create temporary table tonight on commit drop as select private.tonight_began(now()) as began;
grant select on tonight to authenticated;

-- Kunal's visit earlier tonight, over, and his place on a list since.
insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000216', b + (now() - b) * 0.2, b + (now() - b) * 0.4, 'door'
from (select private.tonight_began(now()) as b) s;
insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key, joined_at)
select g.venue_id, '00000000-0000-4000-8000-000000000216', g.table_type_id, g.id, gen_random_uuid(), now() - (now() - private.tonight_began(now())) * 0.1
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 1';

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'Mihir checks in');
select lives_ok($$ select public.check_out('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'out');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213') $$, 'and in again');

select results_eq($$ select visit_id, checked_out_at is null from pg_temp.door('in_club') where member_id = '00000000-0000-4000-8000-000000000213' $$,
  $$ select id, true from public.visit where member_id = '00000000-0000-4000-8000-000000000213' and closed_at is null $$,
  'In the room has his open visit''s row alone');
select results_eq($$ select visit_id from pg_temp.door('left') where member_id = '00000000-0000-4000-8000-000000000213' $$,
  $$ select id from public.visit where member_id = '00000000-0000-4000-8000-000000000213' and closed_at is not null
     and opened_at >= (select began from tonight) $$,
  'Left has his first visit''s, which is over');
select is((select count(*)::int from pg_temp.door(null) where member_id = '00000000-0000-4000-8000-000000000213'), 2, 'everyone has both');

select results_eq($$ select visit_id is null, checked_out_at from pg_temp.door('expected') where member_id = '00000000-0000-4000-8000-000000000216' $$,
  $$ values (true, null::timestamptz) $$, 'one on a list again from outside is expected, by his wait, with no visit');
select is((select count(*)::int from pg_temp.door('left') where member_id = '00000000-0000-4000-8000-000000000216' and checked_out_at is not null), 1,
  'and Left has the visit he had');
select is((select count(*)::int from pg_temp.door('in_club') where member_id = '00000000-0000-4000-8000-000000000216'), 0, 'he is not in the room');
reset role;

select * from finish();
rollback;
