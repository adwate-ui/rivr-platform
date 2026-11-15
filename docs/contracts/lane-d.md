# Lane D: growth and content

The renderer templates (TV layouts, social templates, winner and high-hand cards, membership card, receipt, offline pack), the logo animation, the outbox consumers and their dispatcher, WhatsApp templates, one-click publishing to every channel, winner cards with consent, the social inbox, channel analytics, the social wall, review requests, visit feedback, the Meta and Google conversion events, creators and attribution, the promotions engine with its effects (spin wheel included), the host queue, and the growth funnel. Most of lane D is outbox consumers, testable in isolation; every external call goes through `@rivr/adapters` and never reaches the practice venue (the claim function excludes it).

## Tables owned

| Table | Purpose |
|---|---|
| `promotion`, `promotion_rule`, `promotion_grant`, `promotion_budget` | Rule builder: triggers, conditions, effects, controls (dates, budgets in rupees and count, per-player limits, stacking, a super admin's approval, decision 0244), grants and spend |
| `spin_wheel`, `spin` | Prizes and odds from configuration with a budget cap; spins and results (#150, decision 0266): `public.add_spin_prize`, `remove_spin_prize`, `spin_prizes`, `waiting_spins`, `spin_the_wheel`, and the TVs' `tv_spin_wheel` |
| `reward_item`, `redemption` | Catalogue (tournament seat, F&B upgrade, merchandise, hotel nights) and redemptions |
| `creator`, `tracked_link`, `attribution_touch` | Influencer codes and links, first-touch attribution to KYC, first visit and first buy-in |
| `referral` | Referral codes and the ₹1,000-each-side reward |
| `social_post`, `social_post_channel` | A post's image and caption, and each channel's state: download-and-post until the channel is connected (#154, decision 0269; `public.publish_social_post`, the `social-media` bucket). `social_channel_account` comes with live publishing (#586) |
| `winner_card` | Winner cards (#155, decision 0273): made by a trigger on the outbox from `tournament.finished`, `high_hand.approved` and `jackpot.paid`, removed on `high_hand.reversed` and `jackpot.reversed`; drawn nightly by `render:offline-packs` into the private `winner-cards` bucket; shared only by their player (`shared_at`, `public.share_winner_card`), and then seen by staff who publish marketing (`public.winner_cards_to_post`) |
| `lead`, `inbox_message` | Inbox webhooks into leads (#156, decision 0268): a lead is a conversation, with its messages; a WhatsApp lead linked to the member with that number, now or on sign-up (the `social-inbox` function's `public.record_inbox_messages`; the console's `public.venue_leads`, #587) |
| `channel_metric` | Daily follower counts per channel |
| `wall_post` | Tagged Instagram posts and their moderation (#157, decision 0267): `public.moderate_wall_post`, the TVs' `tv_social_wall`, the website's `public_wall_posts`; the `social-wall` function's `public.record_wall_posts` |
| `feedback`, `review_request` | Visit feedback, asked in the player app (decision 0165): a rating of 1 to 5 once a visit and notes from Profile; anything with a written note is a ticket the General Manager (`feedback.manage`) resolves. `public.my_feedback_visit()`, `public.rate_visit(visit, score, note)`, `public.send_feedback(note)`, `public.venue_feedback(venue)`, `public.resolve_feedback(id, resolution)`. Review request after the third visit, sent regardless of score |
| `host_queue_item` | Lapsed players with churn reasons and offers |

## Functions offered to other lanes

| Function | Used by | What it does |
|---|---|---|
| `private.evaluate_promotions(venue, trigger, context)` | A (buy-in), B (hand logged, tournament entry), C (check-in) | Applies every live promotion whose trigger and conditions match; posts effects (bonus through lane A's `private.credit_bonus`, freeroll ticket, cab eligibility, spin); respects budgets and limits |
| `public.growth_funnel(venue)` | console (Reports, #166) | Every member of the venue by source (`referral`, `creator` with its code, `link` with its utm_source, or `direct`) and how many finished KYC, came in and bought in; counts only, for `reports.read`, never the practice venue (22023) |
| `public.give_card_consent(card)`, `public.withdraw_card_consent(card)` | player app | Consent per winner card; withdrawal takes the post down |
| Views `public_promotion_cards`, `public_wall_posts` | web (C), TVs (B) | No personal data beyond first name and initial; never the practice venue |
| `@rivr/render` templates | B (TVs), C (share and membership cards), A (receipts, statements, offline pack) | Every graphic from `@rivr/ui` |

## Events

- Emits: `promotion.published`, `promotion.offered` (one per member who opted in to marketing, `promotionOfferedSchema`, decision 0143), `promotion.granted`, `post.published`, `lead.created`, `feedback.received`.
- Consumes (as outbox consumers): `hand.logged`, `high_hand.approved`, `jackpot.paid`, `tournament.finished` (winner cards come from a trigger on the outbox, decision 0273); `visit.closed` (feedback survey, review request on the third visit, Meta repeat visit); `member.signed_up`, `kyc.completed`, `cage.buy_in`, `tournament.entered` (Meta Conversions API and Google offline conversions, with consent); `member.signed_up` also for the WhatsApp welcome (`member_welcome`, the first name and member number read at send time; decision 0661); `waitlist.called` (WhatsApp seat call, `waitlistCalledSchema`: member, table name, seat, hold until); `receipt.ready` (WhatsApp receipt notice, `receiptReadySchema`, from lane A's receipts); templates are `WHATSAPP_TEMPLATES` in `@rivr/adapters/whatsapp` (decision 0043), not a table; `promotion.published` (publishing); `promotion.offered` (WhatsApp marketing to an opted-in member, sent only while the promotion runs); `alert.raised` (alert WhatsApp).

## Uses from other lanes

- A: `private.credit_bonus`, rake by member for RIVR Rewards (5% of rake), `private.raise_alert`.
- B: `private.seated_hours`, tournament results.
- C: `private.has_consent`, `private.visits_this_month`, sign-up attribution.

## Screens

Console: `features/promotions` (builder with When, Who, Reward, Limits, simulation, player-card and TV-slide previews), `features/social` (publishing, inbox, wall moderation, analytics), `features/creators`, `features/host-queue`, the growth funnel on Reports (#166), `features/feedback`. Player app: `features/bonus`, `features/promotions`, `features/winner-cards` (inside lane C's tabs). Feature keys: `promotions.feed`, `push.promotion_published` (shared with C).

## Settings keys added

`review.visit_threshold`, `feedback.ticket_threshold`, `spin.budget`, `whatsapp.sender`.
