# 0278: No backups for launch

Date: 28 Oct 2026. Issue #112; the owner's answers of 28 Oct: "Go Supabase only", then "Supabase will remain on free" and "no backups".

- **What there is.** The Supabase org stays on the Free plan, which keeps no daily backups and offers no point-in-time recovery. The off-site nightly backup (decision 0072, `nightly-backup`) is not set up either: no backup key, no R2 buckets, no `backup-*` secrets. Its workflow stays as built and skips each night with its notice. So the club launches with no backup of the database or of Storage.
- **Accepted by the owner, knowing the risk.** A bad migration, a wrong delete or a lost project loses the ledger, the members and the KYC records, with nothing to restore.
- **No restore drill.** With no backup there is nothing to drill, so #112's drill line is not met. Decision 0105's scripted drill stays, for when a backup exists.
- **To change it later**, either:
  - move the org to Pro, for 7 days of daily backups and "Restore to a new project"; or
  - set up the nightly backup from `docs/runbooks/backups-and-restore.md`, which needs no code change; or
  - take a manual dump: `pnpm supabase db dump --project-ref <ref>` for the schema, and the same with `--data-only` for the data.
- **Personal data.** Holding no backups keeps no copies, so the privacy notice's "up to 400 days" is an upper bound the club stays inside.
