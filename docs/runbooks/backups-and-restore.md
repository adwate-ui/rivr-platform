# Backups and restore

Tech plan item 27, features "Backups and exports" (#25, decision 0072). The scripted restore drill is #26.

## What is kept

| Backup | Where | Kept for |
|---|---|---|
| Supabase daily backup | Supabase, per project | 7 days (Pro plan) |
| Point-in-time recovery (PITR) | Supabase, production only, once the add-on is on | the window chosen (7 days) |
| Nightly logical dump and CSV export | The target's backup bucket, outside Supabase: `<target>/nightly/<date>/` | 35 days |
| Each month's first good night | The same bucket: `<target>/monthly/<yyyy-mm>/` | 400 days |

**When it runs.** The nightly backup is the `nightly-backup` workflow, at 08:00 IST, after the club's business day closes. It runs for staging and for production.

**What it makes.** One encrypted file per target per night, `rivr-<target>-<yyyymmdd>.tar.gz.age`, with a `.sha256` beside it. Inside:
- `roles.sql`, `schema.sql` and `data.sql`: Supabase's logical dump, which includes auth's users;
- `cron.sql`: the cron jobs, which no dump holds;
- `csv/`: every table in `public` as CSV;
- `manifest.csv`: each table's row count. The CSVs and the counts come from one snapshot. The dump files were taken a few seconds earlier, each on its own.

**Who reads the database.** The read-only role `rivr_backup`. It reads every table, past row-level security, and can't change anything.

**Encryption.** The file is encrypted with [age](https://age-encryption.org) to the backup key. CI holds only the public half. Without the private key, which lives offline with the owner, the file is unreadable.

**Not included:**
- the Vault's secrets (see "Keep the KYC reference key" below);
- Storage objects (KYC images, media), which the provider's backups don't copy either. Whether they should is open in question #382.

**Retention.** It comes from the buckets' lifecycle rules (below), not from the workflow. A night whose job fails leaves the earlier nights in place.

**Personal data.** Backups hold members' personal data for up to 400 days. A restore brings back members erased since that night, so re-apply those erasures from the audit log before anyone uses the restored data.

## Setting it up (once, by the owner)

1. **The environments first.** Run `scripts/github/setup-repo.sh` again. It creates `backup-staging` and `backup-production`, which only `main` can use.
   - Before adding anything to them, open Settings → Environments and check that each shows "Deployment branches: main".
   - A scheduled run creates an environment with no protection if the script hasn't run yet.
2. **One bucket and one token per target.** In Cloudflare (the production account), create two R2 buckets, `rivr-backups-staging` and `rivr-backups-production`.
   - Give each lifecycle rules: delete `<target>/nightly/` after 35 days and `<target>/monthly/` after 400 days.
   - On `rivr-backups-production`, add a **bucket lock** rule: objects under `production/` are kept for at least 35 days. Nobody, CI included, can then delete or overwrite a production backup early.
   - Create one R2 API token per bucket, with **Object Read & Write** on that bucket only. Note each token's access key ID and secret, and the account's S3 endpoint (`https://<account-id>.r2.cloudflarestorage.com`).
3. **The backup key.** On a computer you trust, run `age-keygen -o rivr-backup-key.txt`.
   - Keep that file offline in two places, for example a password manager and a printed copy in the safe. Losing it makes every backup unreadable.
   - The line `# public key: age1...` is the recipient for step 6. The private key never goes into GitHub.
4. **Keep the KYC reference key.** In each project's Vault (Project Settings → Vault), copy the secret `kyc_reference_key` into the same offline places as the backup key.
   - Aadhaar references are stored as HMACs under that key, and it is never in a backup.
   - Without it, a restored database can't find duplicate Aadhaar numbers among existing members.
5. **The backup role's password.** In each project's SQL editor, run:

   ```
   alter role rivr_backup with login password '<a new long random password>';
   ```

   - Use the Session pooler connection string (Connect → Session pooler) with the user changed to `rivr_backup.<project-ref>` and that password. That is `BACKUP_DB_URL`.
   - Never use `postgres` there: that would let any change merged to `main` write to production.
6. **Each environment's settings** (Settings → Environments):
   - Secrets:
     - `BACKUP_DB_URL`, from step 5;
     - `BACKUP_S3_ACCESS_KEY_ID` and `BACKUP_S3_SECRET_ACCESS_KEY`: that target's own token.
   - Variables:
     - `BACKUP_S3_ENDPOINT`: the R2 endpoint;
     - `BACKUP_BUCKET`: that target's bucket;
     - `BACKUP_AGE_RECIPIENT`: the `age1...` public key.
7. **PITR.** In the Supabase dashboard for production, turn on Point in Time Recovery (Add-ons, 7 days).
8. **First run.** In Actions → nightly-backup → Run workflow, check that both targets upload a file. Then run the restore drill on it, `scripts/backup/restore-drill.sh --latest production --key rivr-backup-key.txt`, and add the result to the drill log below.

**Watching it.**
- Until the settings exist, each target skips with a notice and the workflow stays green. Once they're set, a failed night fails the workflow.
- GitHub emails a failed scheduled run to whoever last changed the workflow's schedule, which is the `adwate-ui` account.
- The owner, or whoever they name, also checks Actions → nightly-backup every Monday.
- GitHub pauses scheduled workflows in a repository with no activity for 60 days.

## Restoring from a nightly backup

You need, on the computer you restore from:
- the backup key and the escrowed `kyc_reference_key`;
- `age`, the AWS CLI, and `psql` from Postgres 17 or later;
- a checkout of this repository.

1. **Download** the night's file and its `.sha256`.
   - Give the AWS CLI the target's token: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_DEFAULT_REGION=auto`.
   - Run `aws s3 cp s3://rivr-backups-production/production/nightly/2026-11-20/ . --recursive --endpoint-url <endpoint>`.
   - Then run `sha256sum -c rivr-production-20261120.tar.gz.age.sha256`.
2. **Decrypt and unpack:** `age -d -i rivr-backup-key.txt rivr-production-20261120.tar.gz.age | tar -xz`. This makes a folder, `rivr-production-20261120`. Note its full path (`realpath rivr-production-20261120`).
3. **Create a new Supabase project** in Mumbai to restore into, and take its Session pooler connection string for `postgres`.
   - Never restore over production. To put a backup back into production, use PITR or the provider's backup ("Restoring production in place").
4. **Load it** from the checkout of this repository: `bash scripts/backup/restore.sh <the unpacked folder's full path> "<new project's connection string>"`.
   - It loads as Supabase's guide does: roles, schema, then data with triggers off, in one transaction. Then the cron jobs.
   - It leaves out the few lines a new project refuses: parameter grants to the platform's own roles, and loads into empty tables.
   - The restore drill runs the same script.
5. **Put the Vault back.** In the new project's Vault, add:
   - `kyc_reference_key`: the escrowed value, exactly;
   - `sign_in_send_key`: a new random value from `openssl rand -hex 32`. It only remembers which numbers got a code in the last ten minutes.
   - `project_url` and `outbox_scheduler_secret`: as `docs/runbooks/ci-and-release.md` describes for a new project, with the matching Edge Function secret.
6. **Re-apply erasures.** Re-apply any member erasures made after the backup was taken.
7. **Check it.**
   - Compare each table's row count with `manifest.csv`. Tables a per-minute job writes to may differ by the rows written in the seconds between the dump and the export.
   - `select jobname from cron.job` lists every job in `cron.sql`.
   - A test member can sign in.
   - The CSVs in `csv/` are there to read without restoring.

## The restore drill

`scripts/backup/restore-drill.sh` (#26) proves a backup restores, without touching staging or production.
- **Where it restores:** a throwaway local Supabase stack, empty like a new project, on the unassigned port block 550. It removes the stack when done, and warns if it couldn't.
- **How:** with `scripts/backup/restore.sh`.
- **What it checks**, before any restored cron job runs:
  - every ledger transaction sums to zero;
  - each ledger account's total equals the total from the backup's own CSV;
  - every table's row count matches `manifest.csv`. Ledger tables must match exactly. Others may differ by the few rows written between the dump and the export, but a table that comes back empty, or more than 5 rows or 1% out, fails.
- **Then:** it restores the cron jobs and checks they're all back.
- **Output:** PASS or FAIL for each check, then a result.

**Running it:** you need Docker, `age`, `psql` from Postgres 17 or later, the AWS CLI for `--latest`, and `pnpm i` in the checkout.
- On a target's latest backup:
  - set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (that target's bucket token), `AWS_DEFAULT_REGION=auto`, `BACKUP_S3_ENDPOINT` and `BACKUP_BUCKET`;
  - run `scripts/backup/restore-drill.sh --latest production --key rivr-backup-key.txt`.
- On a file already downloaded: `--archive <file> --key <key>`.
- On one computer: `--local` backs up the local stack first (`pnpm db:start`), with a throwaway key.
- `--dry-run` prints the steps without running anything.

**When:** after the backup is first set up, in hardening week (11 to 14 Nov), then monthly. Add each run below.

| Date | Backup | Where it was restored | Result |
|---|---|---|---|
| 20 Oct 2026 | The local stack's seed data (`--local`), as the backup job makes it. Staging's and production's are the owner's first run (setup step 8). | Scratch local stack (550) | PASS: every ledger transaction sums to zero; all 10 account totals match the CSV; row counts match for 70 tables; all 6 cron jobs back |

## Restoring production in place

- Use point-in-time recovery for a moment in the last 7 days, or the daily backup.
- In Supabase go to Database → Backups, choose the time or the backup, and restore. The project is unavailable while it restores, and everything after that moment is lost.
- Engage the kill switch first, so nothing is written in between, and note in the incident log what was lost.
