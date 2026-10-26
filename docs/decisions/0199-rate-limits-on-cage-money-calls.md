# 0199: One rate limit for money calls, where the rows are written

Date: 2026-10-26 · Task: #342 (review of #74; `.claude/rules/security.md`, rate limits on money endpoints)

`private.assert_rate(venue, action, per_staff = 30, per_venue = 120)` is the mechanism for money calls. The older per-record limits (KYC calls, the practice reset, computer claims) keep their own. It counts one kind of call in the last minute, for the signed-in staff member and for the venue, in `private.rate_hit`. That table keeps ten minutes of calls, has row-level security, and is closed to API roles. One call at a time per venue and kind holds an advisory lock, so two at once cannot both slip under the limit.

- **Refusal.** A call past either limit is refused with `RVRAT`, the code the KYC and practice-reset limits use.
- **Alert.** The call that reaches a limit goes through and raises `cage.rate_limit`, at most once in 15 minutes per kind. Raising it on the refused call would roll it back with the refusal.
- **Where.** A `before insert` trigger on `cage_transaction` covers buy-ins, cash-outs and marker repayments, and one on `marker` covers marker issues, whichever path writes them.
- **Who.** Only staff calls count. The database's own jobs, the seed and the practice venue's reset are not limited.

The console still shows `RVRAT` as "unavailable" at the cage and for markers; naming it is a follow-up.
