-- The design prompt's live promotion (section 5; #88), in both venues: the referral, published from its template (#85) as
-- it stands. The Tuesday buy-in bonus went with the buy-in trigger (question 1009). A promotion already published (staging, seeded again) is left as the floor has it, and a
-- venue frozen, or with promotions off, is left alone. It runs in versions (decision 0491): its first
-- version goes live, and the promotion copies it. The word-only cards, high hands among them, are retired
-- (decision 0498).
update public.promotion_version v set status = 'live'
from public.promotion p
where p.id = v.promotion_id and p.template_key = 'referral' and v.version = 1 and v.status = 'draft' and p.status = 'draft'
  and p.venue_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')
  and not exists (select 1 from public.control_state c
                  where c.venue_id = p.venue_id and c.released_at is null
                    and (c.level = 'venue_freeze' or (c.level = 'feature_kill' and c.feature = 'promotions')));
select private.sync_promotion(p.id) from public.promotion p
where p.template_key = 'referral' and p.status = 'draft'
  and exists (select 1 from public.promotion_version v where v.promotion_id = p.id and v.status = 'live');
