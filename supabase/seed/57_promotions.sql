-- The design prompt's live promotions (section 5; #88), in both venues: Buy-in bonus Tuesday (20% on
-- the first five buy-ins per table, on Tuesdays), high hands and referral, published from their
-- templates (#85) as they stand. A promotion already published (staging, seeded again) is left as the
-- floor has it, and a venue frozen, or with promotions off, is left alone.
update public.promotion p set status = 'live', starts_at = now()
where p.template_key in ('tuesday_bonus', 'high_hands', 'referral') and p.status = 'draft'
  and p.venue_id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')
  and not exists (select 1 from public.control_state c
                  where c.venue_id = p.venue_id and c.released_at is null
                    and (c.level = 'venue_freeze' or (c.level = 'feature_kill' and c.feature = 'promotions')));
