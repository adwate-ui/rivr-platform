-- Live publishing per channel (#586; decision 0281): a connected channel is sent the post and records its link; the
-- others offer it to download and post; never at the practice venue. Marketing (107) publishes.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
insert into storage.objects (bucket_id, name) values
  ('social-media', '00000000-0000-4000-8000-000000000001/t196.jpg'), ('social-media', '00000000-0000-4000-8000-000000000002/t196.jpg');
-- The club connects Instagram and Telegram; the practice venue claims to as well.
insert into public.setting (venue_id, key, value) values
  ('00000000-0000-4000-8000-000000000001', 'social.connected_channels', '{"channels": ["instagram", "telegram"]}'),
  ('00000000-0000-4000-8000-000000000002', 'social.connected_channels', '{"channels": ["instagram"]}');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'club', public.publish_social_post('00000000-0000-4000-8000-000000000001', 'RIVR Sunday', '00000000-0000-4000-8000-000000000001/t196.jpg', array['instagram', 'telegram', 'x']);
reset role;
select results_eq($$ select channel, status from public.social_post_channel where post_id = (select id from ids where name = 'club') order by channel $$,
  $$ values ('instagram'::text, 'sending'::text), ('telegram', 'sending'), ('x', 'download') $$,
  'a connected channel waits for the consumer; the others offer it to download and post');
select is((select count(*)::integer from public.outbox_event where event_type = 'social.post_published' and payload ->> 'post_id' = (select id::text from ids where name = 'club')), 1,
  'and the consumer is told once');
select results_eq($$ select caption, image_path, channels from public.social_post_to_send((select id from ids where name = 'club')) $$,
  $$ values ('RIVR Sunday'::text, '00000000-0000-4000-8000-000000000001/t196.jpg'::text, array['instagram', 'telegram']) $$,
  'it sends the caption and image to the channels still sending');

select public.record_social_post_channel((select id from ids where name = 'club'), 'instagram', 'https://www.instagram.com/p/C1/');
select public.record_social_post_channel((select id from ids where name = 'club'), 'telegram', null);
select public.record_social_post_channel((select id from ids where name = 'club'), 'x', 'https://x.com/rivr/status/1');
select results_eq($$ select channel, status, post_url from public.social_post_channel where post_id = (select id from ids where name = 'club') order by channel $$,
  $$ values ('instagram'::text, 'published'::text, 'https://www.instagram.com/p/C1/'::text), ('telegram', 'download', null), ('x', 'download', null) $$,
  'published with its link, or refused back to download and post; a channel not sending is left as it was');
select is_empty($$ select * from public.social_post_to_send((select id from ids where name = 'club')) $$, 'nothing is sent twice');

-- Published, then social publishing is switched off before the consumer runs: nothing goes.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'killed', public.publish_social_post('00000000-0000-4000-8000-000000000001', 'Switched off', '00000000-0000-4000-8000-000000000001/t196.jpg', array['instagram']);
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select public.engage_control('00000000-0000-4000-8000-000000000001', 'feature_kill', 'Wrong image on the post', 'social_publishing');
reset role;
select is_empty($$ select * from public.social_post_to_send((select id from ids where name = 'killed')) $$,
  'switched off after publishing, the consumer is given nothing to send');
select results_eq($$ select status from public.social_post_channel where post_id = (select id from ids where name = 'killed') $$,
  $$ values ('download'::text) $$, 'and the channel falls back to download and post');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
insert into ids select 'practice', public.publish_social_post('00000000-0000-4000-8000-000000000002', 'Practice', '00000000-0000-4000-8000-000000000002/t196.jpg', array['instagram']);
reset role;
select results_eq($$ select status from public.social_post_channel where post_id = (select id from ids where name = 'practice') $$,
  $$ values ('download'::text) $$, 'nothing from the practice venue reaches a channel');
select is((select count(*)::integer from public.outbox_event where event_type = 'social.post_published' and payload ->> 'post_id' = (select id::text from ids where name = 'practice')), 0,
  'nor is the consumer told');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select * from public.social_post_to_send((select id from ids where name = 'club')) $$, '42501', null, 'only the consumer reads what to send');
select throws_ok($$ select public.record_social_post_channel((select id from ids where name = 'club'), 'x', 'https://x.com/a') $$, '42501', null, 'or records it');
reset role;
select ok(exists (select 1 from cron.job where jobname = 'outbox-social-publish'), 'pg_cron runs the consumer');

select * from finish();
rollback;
