-- The social wall (#157, #158; decision 0267): the pull records tagged posts for the club, never the practice venue's;
-- staff who publish marketing (107) approve or reject them and a cashier (104) does neither; approved posts reach a TV
-- showing the wall, told at once, and the website, never another club's to its staff nor the practice venue's.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000aa', 'RIVR Test', 'test-wall', false, 'RIVR test', 'Test', 'TST');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.signals(p_event text) returns integer language sql security definer as $$
  select count(*)::integer from realtime.messages m
  where m.topic = 'tv:00000000-0000-4000-8000-000000000001' and m.event = p_event and m.inserted_at >= now();
$$;
grant execute on function pg_temp.signals(text) to authenticated;
-- A tagged post as the pull sends it.
create function pg_temp.post(p_id text, p_handle text, p_at text) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'username', p_handle, 'caption', 'At RIVR tonight', 'media_url', 'https://cdn.example/' || p_id || '.jpg',
                            'media_kind', 'image', 'permalink', 'https://www.instagram.com/p/' || p_id || '/', 'posted_at', p_at);
$$;
grant execute on function pg_temp.post(text, text, text) to service_role;

-- The other club's approved post, and one approved at the practice venue.
insert into public.wall_post (venue_id, source_id, handle, caption, media_url, media_kind, permalink, posted_at, status, moderated_at) values
  ('00000000-0000-4000-8000-0000000000aa', 'aa-1', 'elsewhere', '', 'https://cdn.example/aa.jpg', 'image', 'https://www.instagram.com/p/aa/', now(), 'approved', now()),
  ('00000000-0000-4000-8000-000000000002', 'practice-1', 'practice', '', 'https://cdn.example/p.jpg', 'image', 'https://www.instagram.com/p/pr/', now(), 'approved', now());
-- A TV at the club showing the wall.
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e184', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001841');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d184', '00000000-0000-4000-8000-000000000001', 'tv', 'Wall TV', '00000000-0000-4000-8000-00000000e184');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d184', '00000000-0000-4000-8000-000000000001', 'social_wall');

-- The pull, with the service role.
select set_config('role', 'service_role', true);
select is(public.record_wall_posts('00000000-0000-4000-8000-000000000001',
            jsonb_build_array(pg_temp.post('t184-1', 'zoya.plays', '2026-11-15T18:00:00Z'), pg_temp.post('t184-2', 'kabir.s', '2026-11-15T19:00:00Z'))), 2,
  'the pull records two tagged posts');
select is(public.record_wall_posts('00000000-0000-4000-8000-000000000001',
            jsonb_build_array(pg_temp.post('t184-2', 'kabir.s', '2026-11-15T19:00:00Z'), pg_temp.post('t184-3', 'mira', '2026-11-15T20:00:00Z'))), 1,
  'and only the new one of a post it already holds');
select throws_ok($$ select public.record_wall_posts('00000000-0000-4000-8000-000000000002', jsonb_build_array(pg_temp.post('t184-9', 'x', '2026-11-15T20:00:00Z'))) $$,
  '22023', null, 'never for the practice venue');
select set_config('role', 'postgres', true);

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.wall_post $$, 'a cashier sees no posts');
select throws_ok($$ select public.moderate_wall_post('00000000-0000-4000-8000-000000000001', (select id from public.wall_post where source_id = 't184-1'), true) $$,
  '42501', null, 'and moderates none');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is((select status from public.wall_post where source_id = 't184-1'), 'pending', 'a pulled post waits for moderation');
select lives_ok($$ select public.moderate_wall_post('00000000-0000-4000-8000-000000000001', (select id from public.wall_post where source_id = 't184-1'), true) $$,
  'marketing approves one');
select lives_ok($$ select public.moderate_wall_post('00000000-0000-4000-8000-000000000001', (select id from public.wall_post where source_id = 't184-2'), false) $$,
  'and rejects another');
select throws_ok($$ select public.moderate_wall_post('00000000-0000-4000-8000-000000000001', gen_random_uuid(), true) $$, 'P0002', null, 'a post not there is refused');
select is_empty($$ select * from public.wall_post where venue_id = '00000000-0000-4000-8000-0000000000aa' $$, 'marketing sees no other club''s posts');
select ok(pg_temp.signals('social_wall') > 0, 'the TVs are told of the approval');

select pg_temp.as_person('00000000-0000-4000-8000-00000000e184');
select results_eq($$ select handle from public.tv_social_wall() $$, $$ values ('zoya.plays'::text) $$, 'the TV shows the approved post only');

select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
select ok(exists (select 1 from public.public_wall_posts where handle = 'zoya.plays'), 'the website shows the approved post');
select ok(not exists (select 1 from public.public_wall_posts where handle in ('kabir.s', 'mira', 'practice')),
  'and neither a rejected nor a waiting one, nor the practice venue''s');
select set_config('role', 'postgres', true);
select is(private.site_block_public_keys('social_wall'), array['heading'], 'a wall block shows its heading only');

select * from finish();
rollback;
