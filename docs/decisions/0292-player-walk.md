# 0292: The player app after its walk on staging

Date: 2 Nov 2026. The staging walk of the player app, items P-01 to P-08 on the UI polish tracker, and C-01 from the console's.

- **The KYC return address (P-01).** Staging's `PLAYER_APP_URL`, set by hand that morning, had changed by the afternoon, and Cashfree refused every start. The deploy and the release now set it from `STAGING_PLAYER_URL` and `PROD_PLAYER_URL`, the addresses the player app is deployed to, each checked as an https address first, so a hand-set value cannot drift.
- **A refused start keeps its try (P-02, not done).** Giving a refused start's try back would let a member loop starts without limit while a fault refused them all (the shared client calls every 4xx `rejected`), and the five-a-day cap is the only per-member limit on vendor calls (security review). The fault that used up tries is closed by P-01.
- **Never stuck on Identity (P-03).** Every identity step, the PAN step and a failed return included, offers the front desk and Sign out; Continue to DigiLocker rests once today's tries are used. Before the check no other screen opens, so signing out there has no notifications to take back. Retaking a selfie once it is in is not offered: the server keeps one selfie a check, by design (an issue asks the owner).
- **The waitlist row (P-04, P-05).** The name keeps 96 px, so a wider action goes under it. The stakes show once: hidden only when the game's name already carries them.
- **Phones wider than 390 px (P-06).** The shell and the sheets cap their width only from 768 px up, so on any phone they reach both edges.
- **Sign-in (P-07, C-01).** The next code cell's 2 px edge, gold, or red on a refused code, is the field's focus; the extra ring round the row went. Cells are 48 px, not a share of a tablet's width. +91 takes the number's size; figures stay tabular, as the token says. The code step keeps the number step's lockup, so only the form under it changes.
- **Not changed.** The letter tiles on rewards and dishes stay: the owner's placeholders until the club's photos are added (AS-11).
