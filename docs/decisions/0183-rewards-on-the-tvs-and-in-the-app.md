# 0183: Rewards on the TVs and in the app: two boards in the rotation, and a Rewards tab built from what exists

Date: 2026-10-26 · Tasks: #148, #152

## TVs

**Rewards ticker.** Two columns:

- this League month's five points leaders, by points earned at the tables (both schemes, as `points_earning` holds them);
- the week's last ten redemptions, with the time and the reward.

**League leaderboard.** This month's top ten, and the season's when one runs (decision 0182).

**Layout.** Both use the waitlist board's layout (`TvWaitlistBoard`): a ranked list per column, six places each. No new component.

**Names.** A member shows as a first name and initial, or as "A member" if they hid their name on the TVs (#326). Nobody self-excluded leads.

**Rotation and updates.** Both boards join the rotation the console offers (decision 0163). A redemption or a League finish tells the TVs at once. Otherwise each board reads again every half minute.

## Player app's Rewards tab

**What it shows:**

- points and tier, always;
- the catalogue and the member's redemptions, behind `rewards.catalogue`. Redeem asks first, and charges the price shown;
- the League, behind `league.standings`: the top ten this month and this season, with the member's own place.

**What it leaves out:**

- Tier progress. Tiers are assigned by staff and have no thresholds yet, so there is nothing to progress towards.
- Referral (#151) and cab requests (#140). Neither has a backend yet; each joins the tab with its feature key when built.

**First load.** The player's first load is at its 200 KB budget. So:

- the tab's copy registers when the tab opens (`memberRewards`, as `documents` does);
- its hooks come from the subpath `@rivr/db/myRewards`, as `@rivr/db/site` does, so they load with the tab.
