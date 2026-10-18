---
name: feature-task
description: Take the next ready task issue for a lane and carry it from spec to an open PR. Use at the start of every work session.
---

# Feature task

Argument: the lane (`a`, `b`, `c`, `d`) or an issue number. Example: `/feature-task b` or `/feature-task 42`.

1. Find the task: `gh issue list --label lane:$ARGUMENTS --label status:todo --state open --json number,title,body --limit 50`. Take the lowest-numbered issue whose `Depends on` issues are all closed. Claim it: `gh issue edit <n> --add-label status:doing --remove-label status:todo`.
2. Start from fresh `main`: `git fetch origin && git switch -c task/<n> origin/main`.
3. Read only what the issue names: its spec sections, `docs/contracts/lane-<x>.md` and the listed packages. Use a subagent if you need to explore more than five files.
4. If the task touches more than one package, write a short plan in a draft PR first: packages, functions, tests, out of scope.
5. Write the failing tests from the acceptance criteria. Run them and confirm they fail for the right reason.
6. Implement the smallest change that passes. Run the narrowest test after each step.
7. UI tasks: follow the `new-screen` skill, including the screenshot comparison with the prototype.
8. Run `pnpm verify`. Fix the root cause of any failure; never suppress it.
9. Ask the `reviewer` subagent to review `git diff origin/main...HEAD` against the issue. Money tasks also ask `money-auditor`; UI tasks `ui-guard`; database, adapter or admin tasks `security-reviewer`. Then ask `junior-reader`.
10. Fix findings that affect correctness, the acceptance criteria, the rules or readability. Do not add abstraction, defensive code or tests for impossible cases to satisfy a reviewer.
11. Update the package README. Push and open the PR: `git push -u origin task/<n>` then `gh pr create --title "<type>(<scope>): <summary>" --body "Closes #<n> ..."` with the verify summary and screenshots. Move the issue to `status:review`.
12. If something is unclear, open a `question` issue, take the safest reading, and say so in the PR.
13. Stop. The next task starts after `/clear`.
