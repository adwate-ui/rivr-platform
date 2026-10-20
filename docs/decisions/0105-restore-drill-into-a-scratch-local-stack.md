# 0105: The restore drill restores into a scratch local stack, with the runbook's own script

Date: 2026-10-20 · Task: #26

The drill restores a nightly backup into a throwaway local Supabase stack with nothing in it, as a new
project would be, then removes it. It uses port block 550, which no worktree uses (543 to 549). It never needs a cloud project: creating one isn't
done without the owner, and a drill shouldn't cost money or leave a copy of members' data anywhere.

It restores with `scripts/backup/restore.sh`, the same script the runbook's restore uses. That script
leaves out the lines a new project refuses: parameter grants to the platform's own roles, which only a
superuser could make again, and loads into empty tables, which some of Storage's newer tables refuse.

The checks are independent of the restore, and run before the restored cron jobs, which could post to
the ledger:
- every ledger transaction sums to zero;
- each ledger account's total equals the total from the backup's own CSV, a second copy taken apart
  from the dump;
- row counts match the manifest. Ledger tables must match exactly. Other tables may differ by the few
  rows written in the seconds between the dump and the export, but not by more than 5 rows or 1%, and
  never by coming back empty.

The first run used the local stack's backup. Running it on staging's and production's needs the owner's
backup key, so it's in the runbook's setup steps.
