-- Events off (#637; decision 0284): by its feature key, for every tier, hidden rather than shown locked; a new venue's tiers
-- start with it off; a tier turned back on has it again. Learn and the Academy, which this test also covered, went on 15 Nov
-- (decision 0586). 213 Mihir is a member of the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is(private.has_feature('00000000-0000-4000-8000-000000000213', 'events.book'), false, 'Events is off for a member');
select is((select state from private.feature_state('00000000-0000-4000-8000-000000000213', 'events.book')), 'hidden',
  'and hidden, not shown locked');

select private.bootstrap_venue('00000000-0000-4000-8000-0000000002f2', 'Elsewhere', 'elsewhere-202', false, 'Elsewhere Ltd', 'Somewhere', 'E2X');
select is((select count(*)::integer from public.tier_feature f join public.tier t on t.id = f.tier_id
           where t.venue_id = '00000000-0000-4000-8000-0000000002f2' and f.feature_key = 'events.book'
             and not f.is_enabled and f.display_mode = 'hidden'),
  (select count(*)::integer from public.tier where venue_id = '00000000-0000-4000-8000-0000000002f2'),
  'a new venue''s tiers start with it off and hidden');
select is((select count(*)::integer from public.tier_feature f join public.tier t on t.id = f.tier_id
           where t.venue_id = '00000000-0000-4000-8000-0000000002f2' and f.feature_key = 'fnb.table_side' and f.is_enabled),
  (select count(*)::integer from public.tier where venue_id = '00000000-0000-4000-8000-0000000002f2'),
  'and a feature that does not start off is on for each');

-- A super admin turns Events back on for Mihir's tier.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select m.venue_id, m.tier_id, 'events.book', true, 'locked', now() - interval '1 millisecond'
from public.member m where m.id = '00000000-0000-4000-8000-000000000213';
select is(private.has_feature('00000000-0000-4000-8000-000000000213', 'events.book'), true, 'turned back on, Events is his again');

select * from finish();
rollback;
