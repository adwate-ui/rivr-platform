# 0120 The seed's floor is set at the clock, through the real functions, in both venues

Date: 20 Oct 2026. Task #54.

The design prompt's floor reads Tuesday 00:10. The seed runs on whatever day a stack is reset, so every seeded time is that many minutes before the moment the seed runs:

- the waitlist joins at 23:52, 23:58 and 00:07;
- Pema's down at Table 3 starts at 23:40;
- tonight's high hand is at 22:18.

The fixtures in `@rivr/testing` keep the fixed dates.

The high hand goes through the functions the tablet and the console use: `log_hand`, `claim_high_hand`, `approve_high_hand` and `end_down`. They are called as the table's tablet and as the floor. So its rake, its payout in chips and the down's count are posted as they would be live.

- **The pot.** It is ₹4,800, which drops nothing, so the jackpot stays ₹3,42,600.
- **The tablets.** Tables 2 and 3 have seeded tablets, because a down belongs to a tablet. Their logins have no password, so they never sign in.
- **The practice venue.** It gets the same floor, with its own Kabir, Naina and Rohan (no logins).
- **Staging.** Staging seeds on every deploy, so a venue whose floor has moved on is left alone. That covers a high hand already seeded, a tablet moved or revoked, and a down already open. A venue frozen or with promotions off gets no high hand that time.

Pema's down at Table 3 meets every flow and pgTAP test that deals there:

- **Flows.** A flow that fixes its own tablet to Table 3 ends that down. `assign_tablet` frees the table, and `private.end_tablet_downs` ends its open down.
- **pgTAP tests.** They insert their own assignments, so they first unfix every tablet, which ends the down the same way. Tests that count hands, claims or down counts across a venue now count their own.
