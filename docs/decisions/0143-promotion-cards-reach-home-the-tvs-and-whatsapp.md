# 0143: Promotion cards reach Home, the TVs and WhatsApp from the promotion itself

Date: 2026-10-20 · Task: #86

**The card.** A card is a live promotion's own words, as published (#84): its title, what it gives and
who and when. Nothing composes a card from the rule, so the floor's words reach every surface
unchanged.

**Who reads it.**
- **Home:** the member's venue's cards through `my_promotion_cards()`, with feature `promotions.feed`,
  one at a time with a quiet pager, after the floor.
- **A paired TV:** its own venue's cards through `tv_promotions()`, the practice venue's included for
  training. On Promotions it rotates every 12 seconds, as in the prototype, and is told at once on the
  venue's TV topic when one is published, paused or ends.
- **The website:** `public_promotion_cards`, never the practice venue.

**WhatsApp marketing.** When a promotion is first published, a builder's going live or a template's
draft going live, the database offers it once to each member of the venue who has opted in to
marketing. The offer is one `promotion.offered` event each (member and card), so a retry sends to
one member, never to all again. Resuming a paused promotion offers nothing. The WhatsApp consumer
sends the approved `promotion` marketing template only while the member's opt-in stands. A messaging
stop holds it, and practice-venue events never reach it. This event is lane D's own, added to the
contract's `promotion.published` for the per-member send.
