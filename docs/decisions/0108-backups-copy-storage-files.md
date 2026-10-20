# 0108: The nightly backup copies every Storage file, read with a key held for it alone

Date: 2026-10-20 · Task: #386 (the owner's answer to #382)

The nightly backup now also copies every file in Supabase Storage, KYC selfies and media alike, into the
same archive, encrypted to the same key: `storage/<bucket>/` with the paths the files have there, and
`storage.csv` listing each with its size. Nothing unencrypted leaves the runner. The restore puts the
files back into the new project's buckets at the same paths, after the data has brought back the buckets
and the files' records, so a KYC record still finds its selfie.

Storage is read through its S3 endpoint. Supabase's Storage keys can't be limited to reading; a user's
session under row-level security could be, but only with a read policy on the `kyc` bucket, which the KYC
migration forbids (read access makes long-lived signed links). So the least access that works is a key
made for the backup alone, held only in the `backup-<target>` environment (main only), and revoked if it
may have leaked. The database is still read by the read-only `rivr_backup`. A night that copies fewer
files than Storage's records name fails, and a restore writes files only when asked (`--files`).

Backups keep personal data, KYC photos included, for up to 400 days (nightly 35, monthly 400). The
website's privacy notice says so, and that erasures made since a backup are made again after a restore.
CI's backup check puts a file in the KYC bucket and finds it in the archive, byte for byte.
