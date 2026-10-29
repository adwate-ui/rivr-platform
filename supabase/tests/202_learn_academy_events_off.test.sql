-- Learn, the Academy and Events off (#637; decision 0284): by their feature keys, for every tier, hidden rather than shown
-- locked; a new venue's tiers start with them off; the other Learn features stay; a tier turned back on has them again.
-- 213 Mihir is a member of the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is(private.has_feature('00000000-0000-4000-8000-000000000213', k), false, k || ' is off for a member')
from unnest(array['learn.library', 'academy.booking', 'events.book']) k;
select is((select state from private.feature_state('00000000-0000-4000-8000-000000000213', 'learn.library')), 'hidden',
  'and hidden, not shown locked');
select is(private.has_feature('00000000-0000-4000-8000-000000000213', 'learn.drills'), true, 'the other Learn features stay as they were');

select private.bootstrap_venue('00000000-0000-4000-8000-0000000002f2', 'Elsewhere', 'elsewhere-202', false, 'Elsewhere Ltd', 'Somewhere', 'E2X');
select is((select count(*)::integer from public.tier_feature f join public.tier t on t.id = f.tier_id
           where t.venue_id = '00000000-0000-4000-8000-0000000002f2' and f.feature_key in ('learn.library', 'academy.booking', 'events.book')
             and not f.is_enabled and f.display_mode = 'hidden'),
  (select count(*)::integer * 3 from public.tier where venue_id = '00000000-0000-4000-8000-0000000002f2'),
  'a new venue''s tiers start with all three off and hidden');
select is((select count(*)::integer from public.tier_feature f join public.tier t on t.id = f.tier_id
           where t.venue_id = '00000000-0000-4000-8000-0000000002f2' and f.feature_key = 'learn.drills' and f.is_enabled), 4,
  'and every other feature on');

-- A super admin turns Learn back on for Mihir's tier.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select m.venue_id, m.tier_id, 'learn.library', true, 'locked', now() - interval '1 millisecond'
from public.member m where m.id = '00000000-0000-4000-8000-000000000213';
select is(private.has_feature('00000000-0000-4000-8000-000000000213', 'learn.library'), true, 'turned back on, Learn is his again');

select * from finish();
rollback;
