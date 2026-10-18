# 0024 Lanes run one task at a time, in release-gate order

Date: 18 Oct 2026

The setup guide runs four lane sessions in parallel worktrees plus a reviewer session. The owner chose instead to work one task at a time in the main checkout, and to take tasks by release gate rather than finishing one lane before the next.

Decision: the next task is always the lowest-numbered open issue whose dependencies are closed. Issues #2 to #168 were created in dependency order with release gates first, so this works Release A (30 Oct), then training (1 Nov), then the freeze (10 Nov), moving between lanes as the order requires. The lane contracts still apply: each task's code stays in its lane's tables, functions and folders, and reaches other lanes only through their contracts.

There is no separate reviewer session. After `pnpm verify`, the review subagents (`reviewer`, plus `money-auditor`, `ui-guard` or `security-reviewer` by area, and `junior-reader`) review each PR. Once they pass and CI is green, the working session posts `agent-review` with `scripts/github/post-agent-review.sh` and squash-merges. This replaces the reviewer-session wording of question #176.

One task at a time cannot finish all 72 training tasks by 1 Nov; which ones matter for training day is a choice for the owner closer to the date.
