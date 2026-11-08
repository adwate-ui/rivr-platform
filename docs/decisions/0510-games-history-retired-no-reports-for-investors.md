# 0510: Games history retired; no Reports for investors

Date: 9 Nov 2026 · The owner's answers to the questions in #843

Supersedes: in 0508, "investors included" and "Settings keeps Games history"; the games-history redirects of 0476 and 0488.

**Games history retired.**
- Reports → Tables (decision 0508) covers what Settings → Games history showed (runs and hours by club day and table), and adds players, the most at once and seat use. The owner chose one place.
- The Settings tab, its screen and its client read are removed.
- `/games-history` now lands on Settings with "Games history moved to Reports, Tables.", as other retired addresses do.
- The database read `games_history` stays: other tests still read it, and it has no screen.

**No Reports for investors.**
- The `owner_view` role no longer holds `reports.read`, in the database and in `@rivr/contracts`.
- So the console offers investors no Reports, and every report's check refuses them.
- Investors also no longer read the venue's outbox events, which came with that permission.
