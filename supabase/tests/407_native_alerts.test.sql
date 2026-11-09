-- The other pushes in the native app (#805, decision 0576): an iPhone's alert token, and which phones a push reaches. Ishaan (211)
-- has an iPhone and an Android phone, Vihaan (212) an iPhone that has not given its alert token, Uma (0831) a phone at the practice venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_owner() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.as_service() returns void language sql as $$
  select set_config('role', 'service_role', true), set_config('request.jwt.claims', '', true);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.as_owner(), pg_temp.as_service() to authenticated, service_role;

insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', m, 'push.call_time_complete', true, 'test 405'
from unnest(array['00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000212']::uuid[]) m
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------------
-- Saving.
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
create temp table iphone_key on commit drop as
  select public.save_live_status_device('ios', repeat('a1', 32), null, repeat('b2', 32)) as device_key;
select lives_ok($$ select public.save_live_status_device('android', 'ishaan-phone:APA91bAndroidRegistrationToken', null) $$, 'an Android phone needs no alert token');
select throws_ok($$ select public.save_live_status_device('android', 'ishaan-other:APA91bAndroidRegistrationToken', null, repeat('b2', 32)) $$, '23514', null,
                 'and cannot have one');
select lives_ok($$ select public.save_live_status_device('ios', repeat('a1', 32), (select device_key from iphone_key)) $$, 'saving again without the alert token is no fault');
select pg_temp.as_owner();
select is((select d.alert_token from public.live_status_device d where d.push_token = repeat('a1', 32)), repeat('b2', 32), 'and keeps the one held');
select ok(not has_column_privilege('authenticated', 'public.live_status_device', 'alert_token', 'select'), 'no one signed in reads it');

select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.save_live_status_device('ios', repeat('c3', 32), null) $$, 'an iPhone can save before iOS gives its alert token');

-- ---------------------------------------------------------------------------------------------------
-- Which phones a push reaches.
select pg_temp.as_service();
select set_eq($$ select platform, token from public.native_push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'push.call_time_complete') $$,
              $$ values ('ios', repeat('b2', 32)), ('android', 'ishaan-phone:APA91bAndroidRegistrationToken') $$,
              'an iPhone by its alert token, an Android phone by its Firebase token');
select is_empty($$ select * from public.native_push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'push.call_time_complete') $$,
                'an iPhone with no alert token yet is left out');
select is_empty($$ select * from public.native_push_targets('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000211', 'push.call_time_complete') $$,
                'and nothing crosses venues');

select is_empty($$ select * from public.native_push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', null, gen_random_uuid()) $$,
                'a promotion the member is not offered reaches no phone');

select pg_temp.as_owner();
select ok(exists (select 1 from cron.job j where j.jobname = 'outbox-native-push'), 'the consumer runs every minute');
insert into public.notification_preference (member_id, venue_id, push_type, is_on)
values ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'push.call_time_complete', false);
select pg_temp.as_service();
select is_empty($$ select * from public.native_push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 'push.call_time_complete') $$,
                'a kind the member turned off reaches no phone');
select isnt_empty($$ select * from public.native_push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', null) $$,
                  'a session reminder, the member''s own setting, still does');

select pg_temp.as_owner();
update public.member_feature_override set is_granted = false
where member_id = '00000000-0000-4000-8000-000000000212' and feature_key = 'push.call_time_complete';
update public.live_status_device set alert_token = repeat('d4', 32) where push_token = repeat('c3', 32);
select pg_temp.as_service();
select is_empty($$ select * from public.native_push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'push.call_time_complete') $$,
                'a kind the tier lacks reaches no phone');

select pg_temp.as_owner();
insert into public.member (id, venue_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000d0831', '00000000-0000-4000-8000-000000000002', 'Uma Rao', '+919000000831');
insert into public.live_status_device (venue_id, member_id, platform, push_token, device_key_hash, alert_token)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000d0831', 'ios', repeat('e5', 32), repeat('f6', 32), repeat('a7', 32));
select pg_temp.as_service();
select is_empty($$ select * from public.native_push_targets('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000d0831', null) $$,
                'the practice venue reaches no phone');

select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select throws_ok($$ select * from public.native_push_targets('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', null) $$, '42501', null,
                 'and only the consumer reads the list');

-- ---------------------------------------------------------------------------------------------------
-- One alert token, one member: saved on a new row it leaves the old one.
select pg_temp.as_person('00000000-0000-4000-8000-000000000212');
select lives_ok($$ select public.save_live_status_device('ios', repeat('c4', 32), null, repeat('b2', 32)) $$, 'another phone row can take an alert token');
select pg_temp.as_owner();
select is((select count(*)::integer from public.live_status_device d where d.alert_token = repeat('b2', 32)), 1, 'it is on one row only');
select is((select d.member_id from public.live_status_device d where d.alert_token = repeat('b2', 32)), '00000000-0000-4000-8000-000000000212'::uuid, 'the latest');

-- ---------------------------------------------------------------------------------------------------
-- A dead alert token: an iPhone keeps its row for the live status, an Android phone has only that token.
select pg_temp.as_owner();
create temp table phones on commit drop as
  select d.id, d.platform from public.live_status_device d
  where d.push_token = repeat('c4', 32) or (d.platform = 'android' and d.member_id = '00000000-0000-4000-8000-000000000211');
grant select on phones to service_role;
select pg_temp.as_service();
select public.forget_native_alert((select p.id from phones p where p.platform = 'ios'));
select public.forget_native_alert((select p.id from phones p where p.platform = 'android'));
select pg_temp.as_owner();
select is((select d.alert_token from public.live_status_device d where d.push_token = repeat('c4', 32)), null, 'an iPhone loses only its alert token');
select is_empty($$ select 1 from public.live_status_device d where d.platform = 'android' and d.member_id = '00000000-0000-4000-8000-000000000211' $$, 'an Android phone is forgotten');
select ok(not has_function_privilege('authenticated', 'public.forget_native_alert(uuid)', 'execute'), 'and only the consumer forgets');

select * from finish();
rollback;
