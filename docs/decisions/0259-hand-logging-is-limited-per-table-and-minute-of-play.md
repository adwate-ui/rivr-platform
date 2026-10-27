# 0259: Hand logging is limited per table and minute of play

Date: 2026-10-27 · Context: #298 (security review of #294, L1: one tablet session logged 300 hands back to back).

**Why not the issue's proposal.** #298 proposed refusing a hand whose `played_at` falls within about 20 seconds of another at its table. Such a refusal is permanent, because a retry keeps the same `played_at`. It would refuse real hands: a dealer logging a forgotten hand straight after the next, and the tests and flows that log hands seconds apart.

**Why not a rate by arrival.** A first version counted hands by when they arrived (30 a minute). That treats a long offline replay as a flood: a tablet back after three hours sends 60 real hands at once. The jackpot property test (041) does exactly that, logging three hours of hands in one go.

**What.**
- `log_hand` refuses a hand (`RVFST`) when its table already has 20 hands played within 30 seconds either side of it, so a table holds at most 40 in any minute of play. It counts by `played_at`, on the existing index `(table_id, played_at)`, under a lock per table so two hands sent at once cannot both pass.
- The fastest table plays about one hand a minute. Only a flood, such as hands logged back to back with the time they were sent, reaches 20.
- A replay keeps the times its hands were played, so it passes as they did live, and so does a dealer catching up on two or three hands.
- A refused hand could not have been played at a real table, so the refusal is permanent, and the tablet's queue parks it like any other.
- A replay of a hand already logged returns it before anything is checked.
- **What it does not stop.** A tablet chooses `played_at` anywhere in its down. A hostile tablet can still send hands back to back with their times spread over the down, at most 40 for each minute the down has run. That is bounded, needs a paired tablet and a signed-in dealer, is audited hand by hand, and shows as drop-box variance at the down's count. #298 rates this L1 and not urgent, and the issue's own proposal had the same gap.
