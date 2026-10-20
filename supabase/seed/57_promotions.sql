-- The design prompt's live promotions (section 5; #88), in both venues: Buy-in bonus Tuesday (20% on
-- the first five buy-ins per table), high hands and referral, published from their templates (#85).
-- The seed's clock is the design prompt's Tuesday whatever the date (decision 0120), so here the Tuesday
-- bonus runs every day; the template, and a venue's own, keep Tuesday (decision 0144). A promotion
-- already published (staging, seeded again) is left as the floor has it.
update public.promotion_rule r set conditions = r.conditions - 'days'
from public.promotion p
where p.id = r.promotion_id and p.template_key = 'tuesday_bonus' and p.status = 'draft'
  and p.venue_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');

update public.promotion set status = 'live', starts_at = now()
where template_key in ('tuesday_bonus', 'high_hands', 'referral') and status = 'draft'
  and venue_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
