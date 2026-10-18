# Load tests

k6 scripts for the four scenarios in `docs/spec/additions-2026-10-14.md` ("Load test"). Lane 0 wrote them against the function names in `docs/contracts/`; lane B runs them on staging in hardening week (issue B-044), once those functions exist. Never point them at production.

| Script | Scenario | Pass when |
|---|---|---|
| `waitlist.js` | 60 players join the 100/200 waitlist and watch their position | under 1% errors; join p95 under 800 ms; reads p95 under 500 ms |
| `tablets.js` | Six tablets each log a hand every 90 seconds for 30 minutes | under 1% errors; log_hand p95 under 800 ms |
| `home.js` | 200 app users on Home, refreshing every 15 seconds for 10 minutes | under 1% errors; p95 under 500 ms |
| `registration.js` | 100 tournament registrations within about 10 seconds | under 1% errors; registration p95 under 1.5 s; 99% succeed |

## Running

Staging needs test phone numbers with a test code (Supabase dashboard, Auth, Phone) and those members seeded; the tablets scenario needs six tablet device accounts and their table ids.

```
docker run --rm -i -v "$PWD/load/k6:/scripts" \
  -e SUPABASE_URL=https://<staging-ref>.supabase.co -e SUPABASE_PUBLISHABLE_KEY=... \
  -e LOAD_PHONES=919000001001,919000001002,... -e LOAD_OTP=... -e VENUE_ID=... \
  grafana/k6 run /scripts/waitlist.js
```

`tablets.js` also takes `TABLE_1` to `TABLE_6`; `registration.js` takes `TOURNAMENT_ID`.
