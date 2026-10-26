# Lane D: growth and content

The renderer templates (TV layouts, social templates, winner and high-hand cards, membership card, receipt, offline pack), the logo animation, the outbox consumers and their dispatcher, WhatsApp templates, one-click publishing to every channel, winner cards with consent, the social inbox, channel analytics, the social wall, review requests, visit feedback, the Meta and Google conversion events, creators and attribution, the promotions engine with its effects (spin wheel included), points earning, the rewards catalogue and the League, the host queue, and the growth funnel. Most of lane D is outbox consumers, testable in isolation; every external call goes through `@rivr/adapters` and never reaches the practice venue (the claim function excludes it).

## Tables owned

| Table | Purpose |
|---|---|
| `promotion`, `promotion_rule`, `promotion_grant`, `promotion_budget` | Rule builder: triggers, conditions, effects, controls (dates, budgets in rupees and count, per-player limits, stacking, second-role approval), grants and spend |
| `spin_wheel`, `spin` | Prizes and odds from configuration with a budget cap; spins and results |
| `reward_item`, `redemption` | Catalogue (tournament seat, F&B upgrade, merchandise, hotel nights) and redemptions |
| `points_earning` | What each visit earned in points, by table and from rake, as `private.close_visit` credits it (#89, decision 0161) |
| `league_season`, `league_finish` | Monthly League across cash (hours at the tables, from `points_earning`) and tournament finishes, season championship; standings are computed, not stored (decision 0182) |
| `creator`, `tracked_link`, `attribution_touch` | Influencer codes and links, first-touch attribution to KYC, first visit and first buy-in |
| `referral` | Referral codes and the ₹1,000-each-side reward |
| `social_post`, `social_channel_account`, `winner_card`, `card_consent` | Publishing to each channel, download-and-post fallback, winner cards held for consent |
| `inbox_thread`, `lead` | Inbox webhooks into leads, linked to the member on sign-up |
| `channel_metric` | Daily follower counts per channel |
| `wall_post` | Tagged Instagram posts and their moderation |
| `feedback`, `review_request` | Visit feedback, asked in the player app (decision 0165): a rating of 1 to 5 once a visit and notes from Profile; 3 or below, and every note, is a ticket the General Manager (`feedback.manage`) resolves. `public.my_feedback_visit()`, `public.rate_visit(visit, score, note)`, `public.send_feedback(note)`, `public.venue_feedback(venue)`, `public.resolve_feedback(id, resolution)`. Review request after the third visit, sent regardless of score |
| `host_queue_item` | Lapsed players with churn reasons and offers |

## Functions offered to other lanes

| Function | Used by | What it does |
|---|---|---|
| `private.evaluate_promotions(venue, trigger, context)` | A (buy-in), B (hand logged, tournament entry), C (check-in, Academy graduation) | Applies every live promotion whose trigger and conditions match; posts effects (bonus through lane A's `private.credit_bonus`, points, freeroll ticket, cab eligibility, spin); respects budgets and limits |
| `private.credit_points(venue, member, points, reason, idempotency_key)`, `private.debit_points(...)` | C (Learn, capped daily) | The points ledger; points never convert to cash |
| `public.redeem_reward(item, idempotency_key)` | player app (C screens) | Redemption from the catalogue; feature `rewards.catalogue` |
| `private.award_league_points(tournament, member, place, at)` | B (tournament finish, #149) | A finish's League points, once, from `league.points` (decision 0182) |
| `public.my_league()` | player app (C screens) | This month's and this season's top ten, and the member's own place; feature `league.standings` |
| `public.give_card_consent(card)`, `public.withdraw_card_consent(card)` | player app | Consent per winner card; withdrawal takes the post down |
| Views `public_promotion_cards`, `public_league_table`, `public_wall_posts` | web (C), TVs (B) | No personal data beyond first name and initial; never the practice venue |
| `@rivr/render` templates | B (TVs), C (share and membership cards), A (receipts, statements, offline pack) | Every graphic from `@rivr/ui` |

## Events

- Emits: `promotion.published`, `promotion.offered` (one per member who opted in to marketing, `promotionOfferedSchema`, decision 0143), `promotion.granted`, `points.earned`, `reward.redeemed`, `winner_card.rendered`, `post.published`, `lead.created`, `feedback.received`.
- Consumes (as outbox consumers): `hand.logged`, `high_hand.approved`, `jackpot.paid`, `tournament.finished` (winner cards, League); `visit.closed` (feedback survey, review request on the third visit, Meta repeat visit); `member.signed_up`, `kyc.completed`, `academy.booked`, `cage.buy_in`, `tournament.entered` (Meta Conversions API and Google offline conversions, with consent); `waitlist.called` (WhatsApp seat call, `waitlistCalledSchema`: member, table name, seat, hold until); `receipt.ready` (WhatsApp receipt notice, `receiptReadySchema`, from lane A's receipts); templates are `WHATSAPP_TEMPLATES` in `@rivr/adapters/whatsapp` (decision 0043), not a table; `promotion.published` (publishing); `promotion.offered` (WhatsApp marketing to an opted-in member, sent only while the promotion runs); `alert.raised` (alert WhatsApp).

## Uses from other lanes

- A: `private.credit_bonus`, rake by member for RIVR Rewards (5% of rake), `private.raise_alert`.
- B: `private.seated_hours` (points by hours and stake), tournament results.
- C: `private.has_consent`, `private.visits_this_month`, sign-up attribution.

## Screens

Console: `features/promotions` (builder with When, Who, Reward, Limits, simulation, player-card and TV-slide previews), `features/rewards`, `features/league`, `features/social` (publishing, inbox, wall moderation, analytics), `features/creators`, `features/host-queue`, `features/growth-funnel`, `features/feedback`. Player app: `features/rewards`, `features/promotions`, `features/winner-cards` (inside lane C's tabs). Feature keys: `rewards.catalogue`, `rewards.points_history`, `league.standings`, `promotions.feed`, `push.promotion_published` (shared with C).

## Settings keys added

`points.per_hour` (by stake), `points.rewards_rake_share`, `league.points`, `review.visit_threshold`, `feedback.ticket_threshold`, `spin.budget`, `whatsapp.sender`.
