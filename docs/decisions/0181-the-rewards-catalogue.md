# 0181: The rewards catalogue: four kinds, redeemed with points, handed over by staff

Date: 2026-10-26 · Task: #145

**Kinds.** The catalogue (`reward_item`) holds four kinds of reward:

- tournament seats;
- F&B upgrades;
- merchandise;
- partner hotel nights.

Points never convert to cash (decision 0161). The prototype's "₹1,000 to cash" and its option to pay in rupees are left out.

**Each reward.** A reward has:

- a name;
- where to collect it ("At the host desk");
- a price in whole points;
- optionally a stock, which each redemption takes one from;
- a live flag. A retired reward disappears from members' catalogues.

**Who.**

- `rewards.manage` (super admin, admin, marketing) keeps the catalogue.
- `rewards.hand_over` (super admin, admin, cashier, host) hands redemptions over on the console's Rewards screen. The redemptions list is the record of what is owed to whom.

**Redeeming.** `public.redeem_reward(item, key)` works for a member whose tier has `rewards.catalogue`. It takes the points through `private.debit_points`, never below nothing. The same key again returns the same redemption and takes nothing more. It emits `reward.redeemed`.

**Not built.**

- Per-tier items: the tier gate is the feature key.
- Per-member limits.
- Cancelling a redemption with a refund.
- Issuing a tournament ticket automatically: lane B's tickets (#117) are not built, so the cage registers the seat.

Each is a follow-up if the owner wants it.
