# 0247: Mutation runs that do not hide survivors

Date: 2026-10-27 · Task: #516

**Why.** Stryker counts a mutant that times out as caught. Main's runs showed every money module at 100%, with 156 timeouts and no survivors. The command runner (`stryker.config.mjs`) runs the whole domain suite for each mutant, and Stryker runs several mutants at once. Each run's Vitest started a worker per core, so the machine ran several times as many test workers as it had cores. `--bail=1` stops a run at the first failure, so a mutant no test kills is the slowest run of all, the whole suite. Under that load, survivors crossed the timeout and were counted as caught.

**Evidence.**
- **Cage, alone, one run at a time, 60 s timeout:** 75 killed, 1 survived (`buyIn.ts:31`, `> 0` to `>= 0`). Main had shown it as one of 21 timeouts.
- **Cage, one Vitest worker a run, 60 s timeout:** 0 timeouts, the same survivor, in 111 s. Today's config took 186 s with 9 timeouts.
- **Promotions on the fixed config:** 27 survivors and 3 timeouts, about 94%. Main had shown 100%.

**What.**
- Each run's Vitest uses one worker (`--maxWorkers=1`), so Stryker's own concurrency, one fewer than the cores, is the load.
- The timeout is a minute (`timeoutMS: 60_000`), so a survivor running the whole suite finishes and is counted as a survivor. Only a mutant that loops still times out.
- The per-module floor (80, #512) now reads real scores. The survivors this exposes are killed with real assertions, or the code is simplified so the mutant cannot arise. The survivors are listed by module in a follow-up.
