# 0028 One PR per task

Date: 18 Oct 2026.

Under the 400-line limit, with two or three review agents and a CI run per PR and strict up-to-date merges, one day shipped no feature: sign-in alone became seven PRs. At that pace the 170 tasks do not fit before the 15 November launch.

The owner chose a faster cadence:
- Each task ships as one PR, up to about 800 changed lines.
- One `reviewer` pass. The `security-reviewer` runs only for auth, money or database-policy changes.
- Merge as soon as CI is green and the review passes.
- Build the acceptance criteria and nothing more. Prototype nits, polish and cleanups found on the way become follow-up issues, worked in release-gate order like any task.

CLAUDE.md, "How to work a task", says the same.
