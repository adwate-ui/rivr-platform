-- Channel analytics (#164; decision 0280): the nightly follower counts, and each channel beside the members who signed up
-- from its links, through KYC and the first buy-in. 103 Aditya reads reports; 104 is a cashier, who does not.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Another club, with a reports reader of its own.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000ab', 'RIVR Elsewhere', 'test-channels', false, 'RIVR elsewhere', 'Test', 'TCH');
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e195', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919990001951');
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-0000000000ab', '00000000-0000-4000-8000-00000000e195', 'Other owner', 'Owner', 'owner_view', '+919990001951');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- Tonight's counts, recorded twice (the job ran again), and Instagram's a month ago.
select is(public.record_channel_followers('00000000-0000-4000-8000-000000000001', '[{"channel": "instagram", "followers": 1100}, {"channel": "telegram", "followers": 300}]'), 2,
  'the job records tonight''s count for each channel');
select is(public.record_channel_followers('00000000-0000-4000-8000-000000000001', '[{"channel": "instagram", "followers": 1200}]'), 1, 'again, if it runs twice');
insert into public.channel_metric (venue_id, channel, measured_on, followers)
values ('00000000-0000-4000-8000-000000000001', 'instagram', (now() at time zone 'Asia/Kolkata')::date - 31, 1000);
select results_eq($$ select channel, followers from public.channel_metric where measured_on = (now() at time zone 'Asia/Kolkata')::date order by channel $$,
  $$ values ('instagram'::text, 1200), ('telegram', 300) $$, 'one count per channel a night, the latest kept');
select throws_ok($$ select public.record_channel_followers('00000000-0000-4000-8000-000000000002', '[{"channel": "instagram", "followers": 5}]') $$,
  '22023', null, 'never for the practice venue');
select throws_ok($$ select public.record_channel_followers('00000000-0000-4000-8000-000000000001', '[{"channel": "myspace", "followers": 5}]') $$,
  '23514', null, 'only the publishing channels');

-- A member who signed up from an Instagram link (any case), and finished KYC.
create temp table newbie as
  with made as (insert into public.member (venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000001', 'Channel Newbie', '+919000000952') returning id)
  select id from made;
insert into public.sign_up_attribution (member_id, venue_id, utm_source) select id, '00000000-0000-4000-8000-000000000001', 'Instagram' from newbie;
insert into public.kyc_record (venue_id, member_id, status, verified_at, date_of_birth, photo_path)
select '00000000-0000-4000-8000-000000000001', id, 'verified', now(), '1990-01-01', '00000000-0000-4000-8000-000000000001/' || id || '/selfie.jpg' from newbie;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select * from public.channel_funnel('00000000-0000-4000-8000-000000000001') where channel in ('instagram', 'telegram', 'whatsapp') $$,
  $$ values ('instagram'::text, 1200, 1000, 1, 1, 0), ('telegram', 300, null, 0, 0, 0), ('whatsapp', null, null, 0, 0, 0) $$,
  'each channel: its latest count, the count 30 days before, and its links'' sign-ups through KYC and buy-in');
select is((select count(*)::integer from public.channel_funnel('00000000-0000-4000-8000-000000000001')), 8, 'every publishing channel, counted or not');
select is((select count(*)::integer from public.channel_metric), 3, 'staff who read reports see the counts');
-- A reports reader at another club sees nothing of this one.
select pg_temp.as_person('00000000-0000-4000-8000-00000000e195');
select is_empty($$ select * from public.channel_metric $$, 'a reports reader at another club sees none of these counts');
select throws_ok($$ select * from public.channel_funnel('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'nor this club''s report');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.channel_funnel('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a cashier does not read reports');
select is_empty($$ select * from public.channel_metric $$, 'nor sees the counts');
select throws_ok($$ select public.record_channel_followers('00000000-0000-4000-8000-000000000001', '[]') $$, '42501', null, 'only the job, as the service role, records them');
reset role;
select ok(exists (select 1 from cron.job where jobname = 'outbox-channel-analytics' and schedule = '30 18 * * *'), 'pg_cron runs the job nightly at 00:00 IST');

select * from finish();
rollback;
