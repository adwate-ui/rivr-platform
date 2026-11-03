-- One reward, one card on Tonight (owner, 3 Nov). Tonight's offers are the referral programme's own card (my_referral,
-- which opens Rewards; decision 0320) and then the club's live promotion cards. The referral card's bonus is itself a live
-- promotion's, so that promotion was listed twice: once as the referral card and again as a promotion card. The cards now
-- leave out exactly the promotion my_referral takes its bonus from, when it gives the member a card: they have feature
-- referral.share_cards and the promotion's rule is a bonus of an amount. Any other referral promotion stays a card, and a
-- member without the referral card still sees the club's.
create or replace function private.my_promotion_cards()
returns table (promotion_id uuid, title text, detail text, runs text)
language sql
stable
security definer
set search_path = ''
as $$
  with referral_card as (
    -- my_referral's pick, in its order: the oldest live promotion with a referral bonus.
    select p.id, (r.effect ->> 'amount_paise') is not null as has_amount
    from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
    where p.venue_id = private.current_member_venue_id() and p.status = 'live' and p.starts_at <= now()
      and (p.ends_at is null or p.ends_at > now()) and r.trigger = 'referral' and r.effect ->> 'kind' = 'bonus'
    order by p.created_at
    limit 1
  )
  select c.* from private.promotion_cards(private.current_member_venue_id()) c
  where private.has_feature(private.current_member_id(), 'promotions.feed')
    and not (private.has_feature(private.current_member_id(), 'referral.share_cards')
             and exists (select 1 from referral_card rc where rc.id = c.promotion_id and rc.has_amount));
$$;
