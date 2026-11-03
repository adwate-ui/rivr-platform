# 0438: The typed promotion model: chips, club days and what each reward is given for

Date: 2026-11-03 · Console v3, phase 7 (promotions rebuilt) · Schemas in `@rivr/contracts/promotionModel`, rules in `@rivr/domain/promotions`

**Why.** The brief replaces the hard-coded builder (double, triple, a fixed 20%) with typed Reward, Eligibility, Schedule, Limits and Channels. Several details were left open. Golden files: `promotionRewards.json` and `promotionSchedule.json`.

**What.**
- **Units.** Rewards are points, bonus chips, spins and perks, never paise (decision 0284). One bonus chip is one unit of chip value ("1,000 bonus chips"), given in whole 50s; the database credits chips × 100 paise to the bonus ledger. Points use whole quarters for the multiplier (1.25 to 5), rounded down. The stored jsonb keeps the brief's camelCase names.
- **Schedule.** Days are the club's (06:00 to 06:00 IST). An opening starts at `from` on a listed club day, so 02:00 on Tuesday is the small hours after Tuesday evening, and runs to the next `to`. It may cross midnight or the 06:00 turnover; the same time at both ends is 24 hours. An opening that starts on the end day runs to its close.
- **Buy-ins.** The percent is of the member's own chips, rounded down to whole 50s, then capped. A buy-in paid from bonus earns nothing from any buy-in reward: a percent or fixed buy-in bonus, or bonus chips on the first buy-in (question #392, widened so bonus never pays bonus). "First N buy-ins per table" counts this promotion's grants at that table that club day.
- **What each reward is given for.** Multipliers, hours bonuses and free spins: time played, only the minutes inside the schedule at its stakes and tables. Bonus chips: on a visit, on the visit's first buy-in, on a referral, or on sign-up. Sign-up fires when KYC is verified (step 2). A cab home, a tournament entry and waitlist priority: on a visit.
- **Audiences.** New members: fewer than 30 whole days since joining. Lapsed regulars: last visit 30 or more whole days before. Women: members have no recorded gender, so nobody matches yet (a question for the owner).
- **Stakes off a table.** A promotion limited to stakes or tables gives nothing for an event away from a table.
- **Words.** `describePromotion` is English only (Hindi dropped 18 Oct). It is not `describe`, which would clash with Vitest's.
