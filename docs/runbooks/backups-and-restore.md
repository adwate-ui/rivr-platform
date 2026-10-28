# Backups and restore

Tech plan item 27, features "Backups and exports" (#25, decision 0072). The scripted restore drill is #26. Storage's files are in the backup since #386 (decision 0108).

**The club launches with no backups** (decision 0278, the owner's choice). The org is on Supabase's Free plan, which keeps none, and the nightly backup below is not set up: it skips each night with its notice. Everything below applies once the owner sets it up, or moves the org to Pro for Supabase's own daily backups.

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
- `manifest.csv`: each table's row count. The CSVs and the counts come from one snapshot. The dump files were taken a few seconds earlier, each on its own;
- `storage/<bucket>/`: every file in Supabase Storage, KYC selfies and media alike, at the path it has there, and `storage.csv` listing each with its size (#386, decision 0108). The provider's own backups don't copy these.

**Who reads the database.** The read-only role `rivr_backup`. It reads every table, past row-level security, and can't change anything.

**Who reads Storage.** An S3 access key for the project's Storage, made for the backup alone. Supabase's Storage keys can't be limited to reading: a key can read, write and delete every bucket's files, and make and remove buckets (never the database). Supabase's other S3 sign-in, a user's session under row-level security, could be read-only, but only through a read policy on the `kyc` bucket, which the KYC migration forbids because read access can make signed links that last years. The least access that works is therefore a key used by nothing else, held only in the `backup-<target>` environment, which only `main` can use, so a change must be merged to reach it. Revoke it in Storage → S3 Connection if it may have leaked, and make a new one each year. A night copies at least as many files as Storage's records name, or fails.

**Encryption.** The file is encrypted with [age](https://age-encryption.org) to the backup key. CI holds only the public half. Without the private key, which lives offline with the owner, the file is unreadable.

**Not included:** the Vault's secrets (see "Keep the KYC reference key" below).

**Retention.** It comes from the buckets' lifecycle rules (below), not from the workflow. A night whose job fails leaves the earlier nights in place.

**Personal data.** Backups hold members' personal data, KYC photos included, for up to 400 days: nightly copies 35 days, monthly 400 (the owner's answer to #382). A restore brings back members erased since that night, so re-apply those erasures from the audit log before anyone uses the restored data. The website's privacy notice says both. Every club venue has the page from its bootstrap, production's included (`private.add_website`, #406, decision 0195). What backs the promise to re-apply erasures is question #407.

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
   - **Storage's key.** In each project, Storage → S3 Connection: turn the connection on if it is off, note the endpoint and region, and create a new access key named `nightly-backup`. Note its ID and secret.
6. **Each environment's settings** (Settings → Environments):
   - Secrets:
     - `BACKUP_DB_URL`, from step 5;
     - `BACKUP_S3_ACCESS_KEY_ID` and `BACKUP_S3_SECRET_ACCESS_KEY`: that target's own token;
     - `STORAGE_S3_ACCESS_KEY_ID` and `STORAGE_S3_SECRET_ACCESS_KEY`: that project's `nightly-backup` Storage key, from step 5.
   - Variables:
     - `BACKUP_S3_ENDPOINT`: the R2 endpoint;
     - `BACKUP_BUCKET`: that target's bucket;
     - `BACKUP_AGE_RECIPIENT`: the `age1...` public key;
     - `STORAGE_S3_ENDPOINT` and `STORAGE_S3_REGION`: that project's Storage S3 endpoint and region.
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
4. **Load it** from the checkout of this repository. First make an S3 access key for the new project's Storage (Storage → S3 Connection) and give it as `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID` and `STORAGE_S3_SECRET_ACCESS_KEY`. Then run `bash scripts/backup/restore.sh --files <the unpacked folder's full path> "<new project's connection string>"`.
   - It loads as Supabase's guide does: roles, schema, then data with triggers off, in one transaction. Then the files, then the cron jobs.
   - The data brings back the buckets and the files' records. The files then go back into the same buckets at the same paths, so each record still finds its file: a member's KYC selfie is where their `kyc_record` points.
   - Files are written only with `--files`, so a shell that still holds a key never writes to another project by accident. Once the restore is checked, revoke that Storage key and `unset STORAGE_S3_ENDPOINT STORAGE_S3_ACCESS_KEY_ID STORAGE_S3_SECRET_ACCESS_KEY`.
   - If the files step stops partway, the database is already loaded: don't run the script again. Copy each bucket's files on their own with the same key, `aws s3 cp <folder>/storage/<bucket> s3://<bucket> --recursive --endpoint-url "$STORAGE_S3_ENDPOINT"`, then load the cron jobs with `psql "<connection string>" -f <folder>/cron.sql`.
   - It leaves out the few lines a new project refuses: parameter grants to the platform's own roles, and loads into empty tables.
   - The restore drill runs the same script.
5. **Put the Vault back.** In the new project's Vault, add:
   - `kyc_reference_key`: the escrowed value, exactly;
   - `sign_in_send_key`: a new random value from `openssl rand -hex 32`. It only remembers which numbers got a code in the last ten minutes.
   - `project_url` and `outbox_scheduler_secret`: as `docs/runbooks/ci-and-release.md` describes for a new project, with the matching Edge Function secret.
6. **Re-apply erasures** (#424, decision 0207). The backup still holds members erased after it was taken, and `--files` brought back their KYC files.
   - Take their ids from the project the backup came from, if it still answers, in its SQL editor: `select entity_id, occurred_at from audit_log where action = 'member.erase' and occurred_at >= '<the backup's night>'`. If that project is gone, erasures made since the backup are lost; the owner accepts that (#407).
   - In the new project's SQL editor (as `postgres`), run `select * from private.reapply_member_erasures('<the backup's night>', array['<id>', '<id>']::uuid[]);`. It also makes again any erasure the restored audit log records since then.
   - Each row says `erased`, or why not (for example `Settle these before erasing the member: cash`). Settle that and run it again; running it twice changes nothing.
   - Then remove their KYC files, which the restore put back: on each erased member's record in the console (Members), press Remove KYC files. Or delete the folder `kyc/<venue_id>/<member_id>/` in the new project's Storage.
7. **Check it.**
   - Compare each table's row count with `manifest.csv`. Tables a per-minute job writes to may differ by the rows written in the seconds between the dump and the export.
   - `select jobname from cron.job` lists every job in `cron.sql`.
   - A test member can sign in.
   - The number of files in each bucket matches `storage.csv`, and a member's KYC photo opens on the KYC review screen.
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
| 27 Oct 2026 | The local stack's seed data (`--local`), 152 migrations (#112) | Scratch local stack (550) | First run FAIL: `restore.sh` no longer parsed. Since #409, an apostrophe inside `"${...:?...}"` was read as a quote by bash, so a real restore would have failed too. Fixed, and CI's `check-backup.sh` now parses every backup script. Rerun PASS: every ledger transaction sums to zero; all 100 account totals match the CSV; row counts match for 107 tables; all 13 cron jobs back; the scratch stack removed (99 s) |

**On staging and production (hardening week, by the owner).** The drill needs the backup key's private half, which lives offline with the owner (setup step 3), so no workflow can run it, and none should. The `nightly-backup` workflow makes the backups it restores.
1. Check that Actions → nightly-backup shows a green run for the target in the last day.
2. On a computer with Docker, `age`, `psql` 17, the AWS CLI and a checkout of `main` (`pnpm i`), give the shell that target's bucket token. Type the secret at the prompt, so it stays out of the shell's history. Then run:
   ```
   export AWS_ACCESS_KEY_ID=<the target's R2 token id> AWS_DEFAULT_REGION=auto
   read -rs AWS_SECRET_ACCESS_KEY && export AWS_SECRET_ACCESS_KEY
   export BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com BACKUP_BUCKET=rivr-backups-staging
   bash scripts/backup/restore-drill.sh --latest staging --key rivr-backup-key.txt
   ```
3. Then do the same for production: `BACKUP_BUCKET=rivr-backups-production` and `--latest production`.
4. Add each result to the table above: the date, the night's file, and the PASS or FAIL lines.
5. `unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY` afterwards. The drill restores into a scratch stack on this computer and removes it. Nothing is written to staging or production.

## Restoring production in place

- Use point-in-time recovery for a moment in the last 7 days, or the daily backup.
- In Supabase go to Database → Backups, choose the time or the backup, and restore. The project is unavailable while it restores, and everything after that moment is lost.
- Engage the kill switch first, so nothing is written in between, and note in the incident log what was lost.
- Before restoring, list the erasures made after the moment you restore to: `select entity_id from audit_log where action = 'member.erase' and occurred_at >= '<that moment>'`. The restore takes them back. Afterwards, release the kill switch and re-apply them as in step 6 above: a venue freeze refuses an erasure.
