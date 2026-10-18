-- has_feature() across tiers, overrides, effective dates and the practice venue, and flow 21:
-- an admin removes Learn from the Member tier; a Member loses it, a Black card keeps it; a
-- super_admin grants it back to one Member by override.
-- 101 Vikram (super_admin), 103 Aditya (admin), 201 Arjun (Black card), 202 Kabir (Member),
-- 203 Naina (Member), 301 Asha (Member at the practice venue).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(private.has_feature('00000000-0000-4000-8000-000000000202', 'learn.library'), 'every tier starts with every feature');
select ok(private.has_feature('00000000-0000-4000-8000-000000000202', 'core.withdrawals'), 'core features are always on');
select ok(not private.has_feature('00000000-0000-4000-8000-000000000202', 'learn.source.unknown'), 'an unknown key is off');

-- The admin removes Learn from the Member tier, shown locked.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode)
select venue_id, id, 'learn.library', false, 'locked' from public.tier
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member';
select throws_ok(
  $$ insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, effective_from)
     select venue_id, id, 'learn.drills', false, now() - interval '1 day' from public.tier
     where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member' $$,
  '42501', null, 'a matrix change cannot be backdated'
);
select throws_ok(
  $$ insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
     values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'learn.library', true, 'try') $$,
  '42501', null, 'an admin cannot override a feature for a member'
);
reset role;

select ok(not private.has_feature('00000000-0000-4000-8000-000000000202', 'learn.library'), 'a Member loses Learn');
select ok(private.has_feature('00000000-0000-4000-8000-000000000201', 'learn.library'), 'a Black card member keeps Learn');
select ok(private.has_feature('00000000-0000-4000-8000-000000000301', 'learn.library'), 'the practice venue''s Member tier is unaffected');
select results_eq(
  $$ select state, tiers from private.feature_state('00000000-0000-4000-8000-000000000202', 'learn.library') $$,
  $$ values ('locked'::text, array['Academy graduate', 'Founders'' Circle', 'Black card']) $$,
  'the locked notice names the tiers that have it'
);

-- A change scheduled for tomorrow is not in force today.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select venue_id, id, 'cab.requests', false, 'hidden', now() + interval '1 day' from public.tier
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member';
select ok(private.has_feature('00000000-0000-4000-8000-000000000202', 'cab.requests'), 'a future-dated cell is not yet in force');

-- The super_admin grants Learn back to Kabir alone.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}';
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'learn.library', true, 'Academy instructor');
reset role;
select ok(private.has_feature('00000000-0000-4000-8000-000000000202', 'learn.library'), 'an override grants the feature to that member');
select ok(not private.has_feature('00000000-0000-4000-8000-000000000203', 'learn.library'), 'and to no other Member');

update public.member_feature_override set ends_at = now() - interval '1 second'
where member_id = '00000000-0000-4000-8000-000000000202';
select ok(not private.has_feature('00000000-0000-4000-8000-000000000202', 'learn.library'), 'an expired override no longer applies');

select throws_ok(
  $$ insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled)
     select venue_id, id, 'core.kyc', false from public.tier where name = 'Member' limit 1 $$,
  '23514', null, 'a core feature cannot be gated'
);
select throws_ok($$ update public.tier_feature set is_enabled = true $$, '42501', null, 'matrix cells are never edited');

-- What the apps read.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000203", "role": "authenticated"}';
select is(
  (select state from public.my_feature_access() where feature_key = 'learn.library'), 'locked',
  'my_feature_access shows a Member that Learn is locked'
);
select is((select count(*) from public.my_feature_access())::int, (select count(*) from public.feature)::int,
  'my_feature_access covers every feature');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000104", "role": "authenticated"}';
select is((select count(*) from public.my_feature_access())::int, 0, 'staff get no member feature rows');

select * from finish();
rollback;
