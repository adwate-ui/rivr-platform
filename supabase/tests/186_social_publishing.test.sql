-- One-click publishing (#154; decision 0269): marketing (107) publishes a post with an uploaded image to every channel;
-- with no channel connected, each offers it to download and post. A cashier (104) publishes nothing; an image not the
-- venue's, an unknown channel, or social publishing switched off is refused.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
insert into storage.objects (bucket_id, name) values
  ('social-media', '00000000-0000-4000-8000-000000000001/t186.png'), ('social-media', '00000000-0000-4000-8000-000000000002/t186.png');

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.publish_social_post('00000000-0000-4000-8000-000000000001', 'Sunday', '00000000-0000-4000-8000-000000000001/t186.png', array['instagram']) $$,
  '42501', null, 'a cashier publishes nothing');
select ok(not private.may_upload_social_media('00000000-0000-4000-8000-000000000001/x.png'), 'nor uploads an image');
select is_empty($$ select * from public.social_post $$, 'nor sees the posts');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select ok(private.may_upload_social_media('00000000-0000-4000-8000-000000000001/x.png'), 'marketing uploads an image to its venue''s folder');
select ok(not private.may_upload_social_media('00000000-0000-4000-8000-000000000001/x.gif'), 'an image of the kinds taken only');
select isnt(public.publish_social_post('00000000-0000-4000-8000-000000000001', 'RIVR Sunday: ₹5,00,000 guaranteed', '00000000-0000-4000-8000-000000000001/t186.png',
              array['instagram', 'facebook', 'x', 'linkedin', 'youtube', 'telegram', 'google_business_profile', 'whatsapp']), null,
  'marketing publishes to all eight channels');
select results_eq($$ select count(*)::integer, count(*) filter (where status = 'download')::integer from public.social_post_channel $$, $$ values (8, 8) $$,
  'and with none connected, each offers it to download and post');
select throws_ok($$ select public.publish_social_post('00000000-0000-4000-8000-000000000001', 'Sunday', '00000000-0000-4000-8000-000000000002/t186.png', array['instagram']) $$,
  '22023', null, 'another venue''s image is refused');
select throws_ok($$ select public.publish_social_post('00000000-0000-4000-8000-000000000001', 'Sunday', '00000000-0000-4000-8000-000000000001/t186.png', array['tiktok']) $$,
  '22023', null, 'so is a channel not offered');
select throws_ok($$ select public.publish_social_post('00000000-0000-4000-8000-000000000001', ' ', '00000000-0000-4000-8000-000000000001/t186.png', array['instagram']) $$,
  '22023', null, 'and a post with no caption');

select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
insert into public.control_state (venue_id, level, feature, reason)
values ('00000000-0000-4000-8000-000000000001', 'feature_kill', 'social_publishing', 'Test');
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.publish_social_post('00000000-0000-4000-8000-000000000001', 'Sunday', '00000000-0000-4000-8000-000000000001/t186.png', array['instagram']) $$,
  'RVKIL', null, 'with social publishing switched off, nothing is published');

select * from finish();
rollback;
