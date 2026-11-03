# 0425: CI runs the drill gates in their own job, and mutation in fourteen shares

Date: 4 Nov 2026. Release-20261104-1 stopped before tagging: CI's full run on 63ddd6da ran out of time in two jobs.

- **code** ran into its 15-minute limit. Before console v3 it took about 8 minutes. On the last full run that passed (f38abee9), it spent 471 s on typecheck, lint and unit tests, then 283 s on the drill gates. Add checkout and setup, and nothing was left for a slower runner.
- **mutation** in six shares took 10.4, 21+ (cancelled), 17.4, 11.9, 18.5 and 18.7 minutes. Since #833's money rules, one share holds 482 mutants, and files differ twofold in time per mutant, so balancing by size leaves wide gaps.
- **Decided: shape the jobs to the work, not raise the limits** (time limits stay as warnings).
  - The drill gates move out of `code` into a `drills` job beside it (`verify.mjs drills`), and `ci-ok` needs it.
  - Mutation is shared fourteen ways, so even a slow share stays well under 15 minutes. Ten were tried first: one share took 17.8 minutes, because 15 of its mutants (9 in tournament/seating.ts) loop forever and each holds a worker for Stryker's whole timeout, about 103 s at decision 0247's minute. Size cannot see that.
  - Local `pnpm verify` still runs the drill gates when `packages/drills/` changes.
- **Proved** by a dispatched full run on the branch before landing, as a pull request's own run mutates nothing.
- **Watch:** after each merge, read the job times that land.sh prints. A job over 15 minutes needs a cause.
