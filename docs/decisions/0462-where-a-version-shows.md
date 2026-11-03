# 0462: Where a version shows, and the cab home while cab requests are off

Date: 2026-11-03 · Console v3, phase 7, step 2 · Owner's decisions 2 and 4 (no rupees; `cab.requests` off), decision 0285

**What.**
- **Channels.** A live version shows only on its own channels:
  - Home's cards on the player app, with the member's `promotions.feed` as before;
  - the TV rotation on the TVs;
  - the website on the website, never the practice venue;
  - the WhatsApp offer on WhatsApp.
  A promotion with no version shows everywhere, as its card always did. `private.promotion_shows_on` decides this.
- **Card words.** The builder saves a card's two lines with each draft, from `cardWords` (`describePromotion`'s parts, cut to 200 and 120 characters). The approver reads them with the terms, and `promotion` copies the running version's.
- **Cab home.** A cab-home version shows on no channel while no tier of the venue offers `cab.requests`, so its template never reaches members. The floor still sees the perk on the member's record, since staff book the cab.
- **WhatsApp.** An offer goes out when a promotion first goes live (from a draft, from waiting, or on its scheduled day), and only for a version on WhatsApp. It goes through the outbox, which never claims a practice venue's events. An approved edit of a running promotion offers nothing again.
- **Referral card.** Home's referral card and `my_referral` take the bonus from a version (chips × 100) or from a rule.
