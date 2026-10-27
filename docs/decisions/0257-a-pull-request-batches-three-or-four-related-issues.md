# 0257: A pull request batches three or four related issues

Date: 2026-10-27 · Owner's decision: "Now that we are not using any builder agent, start batching things together. Each PR should cover 3-4 issues. Ensure that this is implemented in world class way." Supersedes the one-task-per-PR rule (0028's size guide, 0243's "each task, or a few closely related ones").

**Why.** With one builder and CI that runs in minutes, each pull request still costs a branch, a local gate run, a review round and a landing. Three or four related issues share all four.

**What.**
- **A batch is three or four ready issues from one area of the app,** for example rewards and growth, the floor or the website. One reviewer then reads one part of the code, and batches seldom touch the same files. Claim them all at the start.
- **One branch, `batch/<area>`, with one commit per issue,** each with its own tests. Each migration has its own version, in order, after main's newest.
- **One run of the local gates for every touched package.** That means coverage, mutation for a money module, the visual baselines for a new story, migration order, and the touched pgTAP and e2e.
- **One review round for the batch:** `reviewer`, plus `security-reviewer`, `money-auditor` or `ui-guard` where an issue needs one.
- **One pull request.** It has a section per issue, listing its acceptance criteria against their evidence, and a `Closes #n` line for each.
- **No line cap.** Each issue's commit stays reviewable on its own.
- **An issue that stalls in review moves to the next batch** rather than holding the others.
