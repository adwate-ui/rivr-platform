-- A promotion run by a rule with no end date becomes version 1 with no last day (decision 0461), so the clock that ends
-- promotions after their last day (private.advance_promotions) leaves it running; one with an end date ends after it.
-- The seed's open-ended promotions, such as the referral bonus, keep no last day either.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A live referral bonus begun a month ago with no end, and one that ended ten days ago.
insert into public.promotion (id, venue_id, name, status, starts_at, ends_at, detail, runs) values
  ('00000000-0000-4000-8000-0000003040a1', '00000000-0000-4000-8000-000000000001', 'Open-ended bonus', 'live', now() - interval '30 days', null,
   '1,000 bonus chips for each referral', 'Every day'),
  ('00000000-0000-4000-8000-0000003040a2', '00000000-0000-4000-8000-000000000001', 'Closed bonus', 'live', now() - interval '30 days',
   now() - interval '10 days', '1,000 bonus chips for each referral', 'Every day');
select private.insert_version_from_rule(p, '{"kind": "bonus_chips", "chips": 1000, "on": "referral"}', '{}')
from public.promotion p where p.id in ('00000000-0000-4000-8000-0000003040a1', '00000000-0000-4000-8000-0000003040a2');

select ok(not (select schedule ? 'endsOn' from public.promotion_version where promotion_id = '00000000-0000-4000-8000-0000003040a1'),
  'an open-ended promotion becomes a version with no last day');
select is((select schedule ->> 'endsOn' from public.promotion_version where promotion_id = '00000000-0000-4000-8000-0000003040a2'),
  private.club_day_of(now() - interval '10 days' - interval '1 second')::text, 'one with an end date keeps its last club day');

select private.advance_promotions();
select is((select status from public.promotion_version where promotion_id = '00000000-0000-4000-8000-0000003040a1'), 'live',
  'the clock leaves the open-ended one live');
select is((select status from public.promotion where id = '00000000-0000-4000-8000-0000003040a1'), 'live', 'and its promotion says live');
select is((select status from public.promotion_version where promotion_id = '00000000-0000-4000-8000-0000003040a2'), 'ended',
  'and ends the one past its last day');

select is_empty($$ select p.name from public.promotion p join public.promotion_version v on v.promotion_id = p.id and v.version = 1
                   where p.ends_at is null and v.schedule ? 'endsOn' and exists (select 1 from public.promotion_rule r where r.promotion_id = p.id) $$,
  'no promotion converted with no end date has a last day, the seed''s referral bonus among them');

select * from finish();
rollback;
