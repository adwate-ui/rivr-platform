-- Promotion cards on Home, the TV rotation and WhatsApp marketing (#86; scope-v1 module 7: "Each
-- promotion carries a player-facing card ... that publishes to the app Home carousel, the TV rotation
-- and, for opted-in players, a WhatsApp marketing template"). A card is a live promotion's title, what
-- it gives and who and when, as published (#84). Members read their venue's with feature
-- promotions.feed; a TV its own venue's; the website public_promotion_cards (never the practice
-- venue). Publishing offers it once to every member who opted in to marketing, as promotion.offered
-- for the WhatsApp consumer, which sends it only while it still runs; resuming a paused one offers
-- nothing. Decision 0143.

-- A venue's live cards, highest priority first, then the newest.
create function private.promotion_cards(p_venue_id uuid)
returns table (promotion_id uuid, title text, detail text, runs text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.detail, p.runs from public.promotion p
  where p.venue_id = p_venue_id and p.status = 'live' and p.starts_at <= now() and (p.ends_at is null or p.ends_at > now())
  order by p.priority desc, p.starts_at desc, p.id;
$$;

-- The member's venue's cards, with feature promotions.feed; none without it.
create function private.my_promotion_cards()
returns table (promotion_id uuid, title text, detail text, runs text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from private.promotion_cards(private.current_member_venue_id()) c
  where private.has_feature(private.current_member_id(), 'promotions.feed');
$$;

-- A paired TV's own venue's cards, for its Promotions rotation.
create function private.tv_promotions()
returns table (promotion_id uuid, title text, detail text, runs text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from private.promotion_cards(private.current_tv_venue_id()) c;
$$;

-- Every club's cards for the website, by the venue's slug: no personal data, never the practice venue.
create function private.public_promotion_card_rows()
returns table (venue_slug text, title text, detail text, runs text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, c.title, c.detail, c.runs from public.venue v cross join lateral private.promotion_cards(v.id) c where not v.is_practice;
$$;

create view public.public_promotion_cards
with (security_invoker = true)
as
select venue_slug, title, detail, runs from private.public_promotion_card_rows();

create function public.my_promotion_cards()
returns table (promotion_id uuid, title text, detail text, runs text)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_promotion_cards(); $$;

create function public.tv_promotions()
returns table (promotion_id uuid, title text, detail text, runs text)
language sql stable security invoker set search_path = ''
as $$ select * from private.tv_promotions(); $$;

-- When a promotion goes live, pauses or ends, the venue's TVs are told at once (their half-minute read
-- is the fallback). When it is first published, a draft going live or a promotion inserted live,
-- each member who opted in to marketing, with promotions.feed, is offered it once, unless marketing
-- sends are switched off. Going live is a write however it is made, the table included, so a frozen
-- venue or switched-off promotions refuse it as publish_promotion does.
create function private.announce_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  perform private.signal_tv(new.venue_id, 'promotions');
  if new.status = 'live' and (tg_op = 'INSERT' or old.status = 'draft') then
    perform private.assert_writable(new.venue_id, 'promotions');
    perform private.emit(new.venue_id, 'promotion.offered',
                         jsonb_build_object('promotion_id', new.id, 'member_id', m.id, 'title', new.name, 'detail', new.detail, 'runs', new.runs),
                         'promotion.offered:' || new.id || ':' || m.id)
    from public.member m
    where m.venue_id = new.venue_id and private.has_consent(m.id, 'marketing') and private.has_feature(m.id, 'promotions.feed')
      and not exists (select 1 from public.control_state c where c.venue_id = new.venue_id and c.level = 'feature_kill'
                      and c.feature = 'marketing_sends' and c.released_at is null);
  end if;
  return null;
end;
$$;

create trigger promotion_announce after insert or update of status on public.promotion
  for each row execute function private.announce_promotion();

-- At send time, for the WhatsApp consumer only: the member to offer the promotion to while it still
-- runs, their tier still has promotions.feed and marketing sends are on; nobody otherwise, so an offer
-- claimed after a pause, an end or the kill switch is handled unsent. Opt-in as message_recipient reads it.
create function private.offer_recipient(p_venue_id uuid, p_member_id uuid, p_promotion_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.phone, r.marketing_opted_in_at from private.message_recipient(p_venue_id, p_member_id) r
  where exists (select 1 from private.promotion_cards(p_venue_id) c where c.promotion_id = p_promotion_id)
    and private.has_feature(p_member_id, 'promotions.feed')
    and not exists (select 1 from public.control_state c where c.venue_id = p_venue_id and c.level = 'feature_kill'
                    and c.feature = 'marketing_sends' and c.released_at is null);
$$;

create function public.offer_recipient(p_venue_id uuid, p_member_id uuid, p_promotion_id uuid)
returns table (phone text, marketing_opted_in_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from private.offer_recipient(p_venue_id, p_member_id, p_promotion_id);
$$;

revoke execute on function private.offer_recipient(uuid, uuid, uuid), public.offer_recipient(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.offer_recipient(uuid, uuid, uuid), public.offer_recipient(uuid, uuid, uuid) to service_role;

grant select on public.public_promotion_cards to anon, authenticated;
revoke execute on function private.promotion_cards(uuid), private.my_promotion_cards(), private.tv_promotions(), private.public_promotion_card_rows(),
  private.announce_promotion() from public, anon, authenticated;
grant execute on function private.public_promotion_card_rows() to anon, authenticated;
grant execute on function private.my_promotion_cards(), private.tv_promotions() to authenticated;
revoke execute on function public.my_promotion_cards(), public.tv_promotions() from public, anon;
grant execute on function public.my_promotion_cards(), public.tv_promotions() to authenticated;
