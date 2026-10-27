# 0253: A pull request is re-run only for a database clash

Date: 2026-10-27 · Owner's decision. Supersedes 0243's rule that a pull request must be up to date with `main`.

**Why.** Every merge moved `main`, and `land.sh` then merged `main` into each open pull request, so each re-ran its whole CI (about 17 jobs) with no change of its own. With five open, the last to land ran CI up to five times, against a limit of 20 jobs at once, so everything queued: on 27 Oct #124 started CI five times in 40 minutes. Once the repository is private, every runner minute is billed. GitHub's merge queue needs an organisation, and Enterprise Cloud for a private repository.

**What.**
- Branch protection no longer requires a pull request to be up to date (`scripts/github/setup-repo.sh`). A green pull request lands as it passed.
- `land.sh` merges it itself; auto-merge is off for the repository, and `land.sh` turns it off on the pull request, since it would merge without the checks below.
- It brings a branch up to date, and CI runs again, only when the pull request and `main`, since the branch left it, both changed `supabase/migrations` or `supabase/seed`: two migrations must not share a version (`check-migration-versions.mjs`) and must apply together, and seed rows share ids. A comparison listing 300 files or more counts as a clash. The check and the merge hold one lock in `/tmp`, so two database changes cannot both pass it at once.
- It merges nothing while the newest finished CI run on `main` has not passed, except the pull request that fixes it (`land.sh <pr> --fixes-main`).
- Anything else two pull requests break together shows in CI on `main` after the merge, which `land.sh` waits for, and is fixed before anything else lands.
