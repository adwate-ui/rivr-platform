-- Where a promotion shows (console v3 phase 7): its live version's channels. Home's cards need the player app (and the
-- member's promotions.feed, as before), the TV rotation the TVs, the website the website (never the practice venue),
-- and the WhatsApp offer WhatsApp, sent only through the outbox, which never claims a practice venue's events. A cab home
-- shows nowhere while no tier of the venue has cab.requests (decision 0285, owner's decision 4). A promotion run by its
-- rule shows everywhere, as its card always did. The referral bonus Home and the referral card read may come from a
-- version too.

-- Whether any tier of the venue offers cab requests now.
create function private.offers_cab_requests(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tier t where t.venue_id = p_venue_id and coalesce((private.current_tier_cell(t.id, 'cab.requests')).is_enabled, false));
$$;

-- Whether a live promotion's card shows on a channel ('playerApp', 'tv', 'website' or 'whatsapp'): its current version's
-- channel, and never a cab home while cab requests are off; a promotion with no version, as before, everywhere.
create function private.promotion_shows_on(p_promotion_id uuid, p_channel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select coalesce((v.channels ->> p_channel)::boolean, false)
           and (v.reward ->> 'kind' <> 'cab_home' or private.offers_cab_requests(v.venue_id))
    from public.promotion p join public.promotion_version v on v.promotion_id = p.id and v.version = p.current_version
    where p.id = p_promotion_id), true);
$$;

-- The oldest live promotion giving a referral bonus, and the bonus: a version's chips, or a rule's paise.
create function private.referral_offer(p_venue_id uuid)
returns table (promotion_id uuid, bonus_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce((v.reward ->> 'chips')::bigint * 100, (r.effect ->> 'amount_paise')::bigint)
  from public.promotion p
  left join public.promotion_version v on v.promotion_id = p.id and v.version = p.current_version
  left join public.promotion_rule r on v.id is null and r.promotion_id = p.id and r.trigger = 'referral' and r.effect ->> 'kind' = 'bonus'
  where p.venue_id = p_venue_id and p.status = 'live' and p.starts_at <= now() and (p.ends_at is null or p.ends_at > now())
    and ((v.reward ->> 'kind' = 'bonus_chips' and v.reward ->> 'on' = 'referral') or r.id is not null)
  order by p.created_at
  limit 1;
$$;

-- As 20261028391800_random_referral_codes_and_monthly_budgets.sql made it, with the bonus from referral_offer.
create or replace function private.my_referral()
returns table (code text, referred integer, bonus_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.referral_code, (select count(*)::integer from public.referral r where r.referrer_member_id = m.id),
         (select o.bonus_paise from private.referral_offer(m.venue_id) o)
  from public.member m
  where m.id = private.current_member_id() and m.erased_at is null and private.has_feature(m.id, 'referral.share_cards');
$$;

-- As 20261105120000_promotion_link.sql made it, on the player app's channel, with the referral offer from referral_offer.
create or replace function private.my_promotion_cards()
returns table (promotion_id uuid, title text, detail text, runs text, link text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.promotion_id, c.title, c.detail, c.runs, p.link
  from private.promotion_cards(private.current_member_venue_id()) with ordinality c(promotion_id, title, detail, runs, n)
  join public.promotion p on p.id = c.promotion_id
  where private.has_feature(private.current_member_id(), 'promotions.feed')
    and private.promotion_shows_on(c.promotion_id, 'playerApp')
    and not (private.has_feature(private.current_member_id(), 'referral.share_cards')
             and exists (select 1 from private.referral_offer(private.current_member_venue_id()) o
                         where o.promotion_id = c.promotion_id and o.bonus_paise is not null))
  -- Still highest priority first, as promotion_cards gives them.
  order by c.n;
$$;

-- As 20261020180832_promotion_cards.sql made it, on the TVs' channel.
create or replace function private.tv_promotions()
returns table (promotion_id uuid, title text, detail text, runs text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from private.promotion_cards(private.current_tv_venue_id()) c where private.promotion_shows_on(c.promotion_id, 'tv');
$$;

-- As 20261029090100_promotion_rules_and_questions.sql made it, on the website's channel; a version for members in their
-- first 30 days is a welcome offer, as a rule for new players is.
create or replace function private.public_promotion_card_rows()
returns table (venue_slug text, title text, detail text, runs text, rules text[], questions jsonb, is_welcome boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, c.title, c.detail, c.runs, p.rules, p.questions,
         exists (select 1 from public.promotion_rule r where r.promotion_id = c.promotion_id and r.conditions ? 'new_player')
         or exists (select 1 from public.promotion_version x where x.promotion_id = c.promotion_id and x.version = p.current_version
                    and x.eligibility ->> 'audience' = 'new_30d')
  from public.venue v
  cross join lateral private.promotion_cards(v.id) c
  join public.promotion p on p.id = c.promotion_id
  where not v.is_practice and private.promotion_shows_on(c.promotion_id, 'website');
$$;

-- As 20261020180832_promotion_cards.sql made it: at send time, only while the promotion still runs and still shows on
-- WhatsApp.
create or replace function private.offer_recipient(p_venue_id uuid, p_member_id uuid, p_promotion_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.phone, r.marketing_opted_in_at from private.message_recipient(p_venue_id, p_member_id) r
  where exists (select 1 from private.promotion_cards(p_venue_id) c where c.promotion_id = p_promotion_id)
    and private.promotion_shows_on(p_promotion_id, 'whatsapp')
    and private.has_feature(p_member_id, 'promotions.feed')
    and not exists (select 1 from public.control_state c where c.venue_id = p_venue_id and c.level = 'feature_kill'
                    and c.feature = 'marketing_sends' and c.released_at is null);
$$;

-- As 20261028390900_google_review_request.sql made it: a promotion first going live (from a draft, from waiting, or on its
-- scheduled day) is offered on WhatsApp only when its version shows there.
create or replace function private.announce_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  perform private.signal_tv(new.venue_id, 'promotions');
  if new.status = 'live' and (tg_op = 'INSERT' or old.status in ('draft', 'pending', 'scheduled'))
     and private.promotion_shows_on(new.id, 'whatsapp') then
    perform private.assert_writable(new.venue_id, 'promotions');
    perform pg_advisory_xact_lock(hashtext('promotion-offers:' || new.venue_id::text));
    perform private.emit(new.venue_id, 'promotion.offered',
                         jsonb_build_object('promotion_id', new.id, 'member_id', m.id, 'title', new.name, 'detail', new.detail, 'runs', new.runs),
                         'promotion.offered:' || new.id || ':' || m.id)
    from public.member m
    where m.venue_id = new.venue_id and private.has_feature(m.id, 'promotions.feed') and private.may_send_marketing(new.venue_id, m.id);
  end if;
  return null;
end;
$$;

revoke execute on function private.offers_cab_requests(uuid), private.promotion_shows_on(uuid, text), private.referral_offer(uuid)
  from public, anon, authenticated;
