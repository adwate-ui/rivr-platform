# 0183: Rewards on the TVs and in the app

Date: 2026-10-26 · Tasks: #148, #152 · Question: #456 (tier progress)

## TVs

**Rewards ticker.**
- This League month's five points leaders, by points earned at the tables.
- The week's last six redemptions, newest first.

**League leaderboard.** This month's places and the season's (decision 0182).

**Layout.** Both reuse the waitlist board's layout (`TvWaitlistBoard`), six places to a column.

**Names.** A first name and initial, or "A member" for someone who hid their name on the TVs. Nobody self-excluded shows.

**Updates.** A redemption or a League finish tells the TVs at once. A name hidden, or a break started, shows within the half-minute re-read.

## Player Rewards tab

**What it shows.**
- Points and tier, always.
- The catalogue (redeem asks first, at the price shown) and the member's redemptions, behind `rewards.catalogue`.
- The League with their own place, behind `league.standings`.

**What it leaves out.**
- Tier progress: tiers have no thresholds (#456).
- Referral (#151) and cab requests (#140): each joins the tab when it is built.

**First load.** The player's first load is at its 200 KB budget. The tab's copy and its hooks (`@rivr/db/myRewards`, a subpath like `@rivr/db/site`) load with the tab.
