-- A feature taken from one member by an override names no tier as the way in (#353). 201 Arjun holds a
-- black card, which has Events; 202 Kabir is a Member; 101 Vikram, a super admin, sets overrides.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Events is off since #637 (decision 0284): this test turns it back on for every tier.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, k.key, true, 'locked', now() - interval '2 seconds'
from public.tier t cross join (values ('events.book')) as k (key);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- The Member tier loses Events; the black card keeps it.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select venue_id, id, 'events.book', false, 'locked', now() - interval '1 second' from public.tier
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member';
select results_eq($$ select state, tiers from private.feature_state('00000000-0000-4000-8000-000000000202', 'events.book') $$,
  $$ values ('locked'::text, array['Founders'' Circle', 'Black card']) $$,
  'a Member locked out by the tier sees the tiers that have Events');

-- Vikram takes Events from Arjun alone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select isnt(public.set_feature_override('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', 'events.book', false,
  'Sharing his account'), null, 'Vikram takes Events from Arjun');
reset role;
select results_eq($$ select state, tiers from private.feature_state('00000000-0000-4000-8000-000000000201', 'events.book') $$,
  $$ values ('locked'::text, '{}'::text[]) $$, 'Arjun''s notice names no tier, not even his own black card');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select results_eq($$ select state, tiers from public.my_feature_access() where feature_key = 'events.book' $$,
  $$ values ('locked'::text, '{}'::text[]) $$, 'and his app reads it so');
reset role;

-- An override taking away a feature the member's tier hides keeps it hidden.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select venue_id, id, 'events.book', true, 'hidden', now() - interval '1 second' from public.tier
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Black card';
select results_eq($$ select state, tiers from private.feature_state('00000000-0000-4000-8000-000000000201', 'events.book') $$,
  $$ values ('hidden'::text, '{}'::text[]) $$, 'where the tier hides it, the override keeps it hidden');

select * from finish();
rollback;
