-- What the removal of the card, Social, the kill switch, the cage and the older screens kept (decision 0587). The kinds
-- that went can be set no more, though their enum values remain; Activity is read by a permission of its own, a super
-- admin's alone; the settings' guards name only keys that stay; and a new venue starts without what went.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- A TV shows none of the boards that went, as its main board or in its rotation.
insert into public.device (id, venue_id, kind, name) values
  ('00000000-0000-4000-8000-00000000d418', '00000000-0000-4000-8000-000000000001', 'tv', 'Bar TV');
insert into public.tv_screen (device_id, venue_id, mode) values
  ('00000000-0000-4000-8000-00000000d418', '00000000-0000-4000-8000-000000000001', 'waitlist');
select throws_ok($$ update public.tv_screen set mode = 'jackpot' where device_id = '00000000-0000-4000-8000-00000000d418' $$, '23514', null,
  'a TV cannot be put on the jackpot board');
select throws_ok($$ update public.tv_screen set rotation = array['social_wall']::public.tv_mode[] where device_id = '00000000-0000-4000-8000-00000000d418' $$,
  '23514', null, 'nor have the social wall in its rotation');
select throws_ok($$ update public.tv_screen set rotation = array['promotions', 'tournament_clock']::public.tv_mode[] where device_id = '00000000-0000-4000-8000-00000000d418' $$,
  '23514', null, 'nor the tournament clock');
select lives_ok($$ update public.tv_screen set mode = 'leaderboard', rotation = array['waitlist', 'call_time', 'promotions']::public.tv_mode[]
                   where device_id = '00000000-0000-4000-8000-00000000d418' $$, 'the four boards there are can all be set');

-- No door kiosk is paired again; one already revoked may stay as history.
select throws_ok($$ insert into public.device (venue_id, kind, name) values ('00000000-0000-4000-8000-000000000001', 'door', 'Front door') $$,
  '23514', null, 'a door kiosk cannot be added');
select lives_ok($$ insert into public.device (venue_id, kind, name, revoked_at, revoked_reason)
                   values ('00000000-0000-4000-8000-000000000001', 'door', 'Old front door', now(), 'The door kiosk went') $$,
  'one revoked before stays');

-- The website has no wall and no jackpot block.
select throws_ok($$ insert into public.site_block (page_id, venue_id, kind, position, content)
                    select p.id, p.venue_id, 'social_wall', 9000, '{}'::jsonb from public.site_page p
                    where p.venue_id = '00000000-0000-4000-8000-000000000001' limit 1 $$, '23514', null, 'a page takes no social wall block');
select throws_ok($$ insert into public.site_block (page_id, venue_id, kind, position, content)
                    select p.id, p.venue_id, 'jackpot', 9001, '{}'::jsonb from public.site_page p
                    where p.venue_id = '00000000-0000-4000-8000-000000000001' limit 1 $$, '23514', null, 'nor a jackpot block');

-- Activity: its own permission, which only a super admin may hold.
select results_eq($$ select role::text from public.role_permission where permission = 'activity.read' $$, $$ values ('super_admin'::text) $$,
  'activity.read is the super admin''s');
select throws_ok($$ insert into public.role_permission (role, permission) values ('admin', 'activity.read') $$, '23514', null,
  'and no other role can be given it');
select is((select count(*)::integer from public.role_permission
           where permission in ('control.engage', 'purge.run', 'marketing.publish', 'markers.issue', 'withdrawals.approve', 'jackpots.approve')),
  0, 'no role holds a permission that went');

-- 101 is a super admin; 103 is an admin.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001', null, null, null, null, null, null, 5) $$,
  'a super admin reads Activity');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.activity_log('00000000-0000-4000-8000-000000000001', null, null, null, null, null, null, 5) $$,
  'an admin reads none of it');
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);

-- The settings that went are no settings, and the guards name none of them.
select is((select count(*)::integer from public.setting_key
           where key in ('aml.structuring', 'card.qr_rotation_seconds', 'dealer.rotation_minutes', 'high_hand.payouts', 'host.lapse', 'markers.due_days',
                         'social.connected_channels')), 0, 'the seven setting keys are gone');
select is((select count(*)::integer from pg_trigger t
           where t.tgrelid = 'public.setting'::regclass and not t.tgisinternal
             and pg_get_triggerdef(t.oid) ~ 'high_hand\.payouts|aml\.structuring'), 0, 'and no guard on settings names one');

-- A new venue starts without chips, quizzes, SOPs or a card, and with the features that went nowhere on its tiers.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000004e8', 'Elsewhere', 'elsewhere-418', false, 'Elsewhere Ltd', 'Somewhere', 'E418');
select is((select count(*)::integer from public.tier_feature f
           where f.venue_id = '00000000-0000-4000-8000-0000000004e8'
             and f.feature_key in ('core.membership_card', 'core.kill_switch_banner', 'core.withdrawals', 'balance.deposits', 'events.book', 'social.winner_cards')),
  0, 'a new venue''s tiers carry no feature that went');
select isnt((select count(*)::integer from public.tier where venue_id = '00000000-0000-4000-8000-0000000004e8'), 0, 'and it has its tiers');
select is((select count(*)::integer from public.setting where venue_id = '00000000-0000-4000-8000-0000000004e8' and key = 'bonus.daily_staff_cap'), 1,
  'and its daily limit on Bonus by hand');

select * from finish();
rollback;
