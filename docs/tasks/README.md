# Tasks

Tasks live as GitHub issues, not files, so their state (todo, doing, review, done) is visible on GitHub and closes when the PR merges.

- Labels: `lane:a`, `lane:b`, `lane:c`, `lane:d`; `status:todo`, `status:doing`, `status:review`; `question`; `release:A` (30 Oct), `release:training` (1 Nov), `release:freeze` (10 Nov).
- Dependencies: a `Depends on: #12, #15` line in the body. A task is ready when every dependency is closed.
- A PR closes its issue with `Closes #<n>`. Merging closes the issue; nothing else marks a task done.
- Questions are issues labelled `question`. The owner answers them; the answer is recorded in a comment and the issue closed. Until then the work takes the safest reading and says so in the PR.
- Tasks are worked one at a time: always the lowest-numbered open issue whose dependencies are closed (`docs/decisions/0024`).
- `main` requires the `agent-review` status. It is posted only after the review subagents pass, with `scripts/github/post-agent-review.sh <pr> success "<who reviewed>"` (or `failure`), never to skip a review.
- `docs/tasks/coverage.md`, written once by Lane 0, maps every requirement in every spec file to an issue number. Coverage is read from issue state; the file is not edited after Lane 0.

## Issue body format

```
Spec: docs/spec/features-2026-10-14.md "Roles"; scope-v1 module 2
Depends on: #10, #3
Packages: domain (waitlist), db, apps/console features/waitlist, ui WaitlistRow

Acceptance
- A black-card member joining the 100/200 list behind five members is first.
- The same member on the 50/100 list is placed by join time.
- Weights come from effective-dated config.

Out of scope
- Call-down messages (#16)

Verify
pnpm test --filter domain -- waitlist && pnpm e2e --grep "Black card at another stake"
```

Title: `B-014 Waitlist priority for black card at qualifying stake`. One session and one PR (under 400 changed lines) per task.
