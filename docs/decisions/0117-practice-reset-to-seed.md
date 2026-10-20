# 0117: Reset to seed on the practice venue

Date: 2026-10-21 · Task: #104 (the owner's decision of 21 Oct: the practice reset now; purging a live venue, with its automatic export, is #432)

**What resets.** A practice venue's play: members, visits, seats, hands, the cage, the ledger, promotions, tournaments, messages and kill-switch controls. That means every venue table except a short keep list (`private.practice_reset_keeps()`), so a new table resets unless it is kept. Kept are:
- the venue's setup: staff, devices, configuration, settings, tiers, chips, tables, invoice series, the website;
- its staff records: SOPs and acknowledgements, quizzes and every certification attempt;
- the audit log.

No kept row refers to a row that resets.

**The seed.** `private.practice_seed` holds a copy of each practice venue's play, taken by `capture_practice_seed`. The last seed file takes it locally and on staging. Where no seed runs, the migration takes the venue as it stands then.

**How.** One transaction, for a super admin of the practice venue who types its name. The reset:
1. switches off the tables' own triggers (`disable trigger user`), so the reload replays nothing: no member accounts opened twice, no promotions run, no messages queued;
2. deletes the venue's play in one statement and reloads the seed's copy in another; foreign keys stay on and are checked at the end of each statement, so tables that refer to each other (a cage shift and its chip count) need no order;
3. checks that every ledger transaction balances and every table matches its seed;
4. writes one audit row.

`session_replication_role = replica` was the first choice. Supabase refuses it to `postgres`, so it is not used. Switching triggers off holds writes to those tables, the club's included, until the reset commits, so it waits at most five seconds for them.
