-- One-click publishing (#154; decision 0269): marketing (107) publishes a post with an uploaded image to every channel;
-- with no channel connected, each offers it to download and post. A cashier (104) publishes nothing; an image not the
-- venue's, an unknown channel, or social publishing switched off is refused.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Another club, with a post of its own.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000aa', 'RIVR Test', 'test-publish', false, 'RIVR test', 'Test', 'TST');
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e187', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001871');
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000e187', 'Other marketing', 'Marketing', 'marketing', '+919990001871');
insert into storage.objects (bucket_id, name) values ('social-media', '00000000-0000-4000-8000-0000000000aa/t186.png');
insert into public.social_post (venue_id, caption, image_path, created_by_staff_id)
select '00000000-0000-4000-8000-0000000000aa', 'Elsewhere', '00000000-0000-4000-8000-0000000000aa/t186.png', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-00000000e187';
insert into public.social_post_channel (venue_id, post_id, channel, status)
select venue_id, id, 'instagram', 'download' from public.social_post where caption = 'Elsewhere';

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
select is_empty($$ select * from public.social_post_channel $$, 'nor where they went');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select ok(private.may_upload_social_media('00000000-0000-4000-8000-000000000001/x.png'), 'marketing uploads an image to its venue''s folder');
select ok(not private.may_upload_social_media('00000000-0000-4000-8000-000000000001/x.gif'), 'an image of the kinds taken only');
select ok(not private.may_upload_social_media('00000000-0000-4000-8000-0000000000aa/x.png'), 'and never to another club''s folder');
select is_empty($$ select * from public.social_post where venue_id = '00000000-0000-4000-8000-0000000000aa' $$, 'marketing sees no other club''s posts');
select is_empty($$ select * from public.social_post_channel where venue_id = '00000000-0000-4000-8000-0000000000aa' $$, 'nor where they went');
select isnt(public.publish_social_post('00000000-0000-4000-8000-000000000001', 'RIVR Sunday: ₹5,00,000 guaranteed', '00000000-0000-4000-8000-000000000001/t186.png',
              array['instagram', 'facebook', 'x', 'linkedin', 'youtube', 'telegram', 'google_business_profile', 'whatsapp']), null,
  'marketing publishes to all eight channels');
select results_eq($$ select count(*)::integer, count(*) filter (where status = 'download')::integer from public.social_post_channel
                     where venue_id = '00000000-0000-4000-8000-000000000001' $$, $$ values (8, 8) $$,
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
select ok(not private.may_upload_social_media('00000000-0000-4000-8000-000000000001/x.png'), 'nor an image uploaded');

select * from finish();
rollback;
