# 0072: Nightly backups run as a read-only role, encrypted with age, into R2 outside Supabase

Date: 2026-10-20 · Task: #25

`nightly-backup` runs at 08:00 IST, after the business day closes, for staging and production. It writes:
- Supabase's documented logical dump (roles, schema, data as COPY);
- the cron jobs, which no dump holds, as `cron.sql`;
- a CSV of every `public` table, with a manifest of row counts from one snapshot. That is the nightly full export.

It signs in as `rivr_backup`, which has `pg_read_all_data` and bypasses row-level security, and nothing
more. The Supabase CLI's own dump script is run without its switch to `postgres`, so the database URL in
the main-only `backup-*` environments can't write anything, whatever is merged to main.

The archive is encrypted with age to a public key, and the private key stays offline with the owner. So
does the Vault's `kyc_reference_key`, which no backup holds by design. Each target has its own R2 bucket
and token, and production's bucket is locked for 35 days. Lifecycle rules keep nightly copies 35 days and
monthly copies 400.

A target without settings skips with a notice. To keep the script from going stale before then, CI's
security job backs up the local stack as `rivr_backup` and checks the result. Storage objects aren't
backed up until the owner answers #382.
