---
name: feature-task
description: Take the next ready task issue and carry it from spec to a merged PR. Use at the start of every work session.
---

# Feature task

Tasks are worked one at a time in the main checkout, in issue-number order: the issues were created in dependency order with release gates first (docs/decisions/0024). Argument: optional, an issue number. Example: `/feature-task` or `/feature-task 42`.

1. Find the batch (`docs/decisions/0257`): `gh issue list --label status:todo --state open --json number,title,body,labels --limit 200`. Take three or four ready issues from one area of the app, lowest-numbered first, whose `Depends on` issues are all closed (or the ones named in the argument). Claim each: `gh issue edit <n> --add-label status:doing --remove-label status:todo`.
2. Start from fresh `main`: `git fetch origin && git switch -c batch/<area> origin/main`. One commit per issue, each with its own tests; each issue's migration a version of its own, after main's newest.
3. Read only what the issue names: its spec sections, the contract for its lane label (`docs/contracts/lane-<x>.md`) and the listed packages. Use a subagent if you need to explore more than five files.
4. If the task touches more than one package, write a short plan in a draft PR first: packages, functions, tests, out of scope.
5. Write the failing tests from the acceptance criteria. Run them and confirm they fail for the right reason.
6. Implement the smallest change that passes. Run the narrowest test after each step.
7. UI tasks: follow the `new-screen` skill, including the screenshot comparison with the prototype.
8. Run `pnpm verify`. Fix the root cause of any failure; never suppress it.
9. Ask the `reviewer` subagent to review `git diff origin/main...HEAD` against the issue. Money tasks also ask `money-auditor`; UI tasks `ui-guard`; database, adapter or admin tasks `security-reviewer`. Then ask `junior-reader`.
10. Fix findings that affect correctness, the acceptance criteria, the rules or readability. Do not add abstraction, defensive code or tests for impossible cases to satisfy a reviewer. Ask the reviewers that found something to confirm the fix.
11. Update the package READMEs. Push and open one PR for the batch: `git push -u origin batch/<area>` then `gh pr create --title "<type>(<scope>): <summary>"` with a body that has a section per issue (acceptance criteria → evidence), the gates' results, screenshots and the reviews, and a `Closes #<n>` line for each issue. Move every issue to `status:review`.
12. When CI is green and every reviewer has passed: `scripts/github/post-agent-review.sh <pr> success "<who reviewed>"`, then `scripts/github/land.sh <pr>` in the background: it merges once CI is green, bringing the branch up to date with main only when both changed migrations or seed (decision 0253). The merge closes the issue.
13. If something is unclear, open a `question` issue, take the safest reading, and say so in the PR.
14. Take the next batch.
