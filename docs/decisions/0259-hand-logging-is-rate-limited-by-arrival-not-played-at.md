# 0259: Hand logging is rate-limited by arrival, not by played_at

Date: 2026-10-27 · Context: #298 (security review of #294, L1: one tablet session logged 300 hands back to back).

**Why not the issue's proposal.** #298 proposed refusing a hand whose `played_at` is within about 20 seconds of another at its table. That refusal would be permanent: a retry keeps the same `played_at`. Two cases would then lose real hands, and a lost hand shows as drop-box variance:
- a dealer logging a forgotten hand straight after the next;
- the offline queue, whose hands keep the times they were typed.
It would also break the many tests and e2e flows that log hands seconds apart.

**What.**
- `log_hand` refuses a new hand with `RVFST` once its table has logged 30 hands in the last minute. It counts by when hands arrive (`created_at`), with an index on `(table_id, created_at)`. The fastest table plays about one hand a minute, so only a flood or a long replay reaches 30.
- A replay of a hand already logged returns it before the limit is checked.
- The tablet's queue treats `RVFST` as "try again later", as it does a freeze. A long offline replay therefore waits a minute and carries on, rather than parking hands.
- This answers #298's "replays and a throttle must agree": they agree because the limit never refuses a hand for good.
