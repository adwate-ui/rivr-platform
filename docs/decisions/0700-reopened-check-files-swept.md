# 0700 A reopened check's files are swept on a schedule

Date: 19 Nov 2026. Follows #931 (decision 0583's follow-up).

- Reopening a verified desk check lists its three files in `private.kyc_reopened_file`, and the console asks `kyc-reopened-files` to remove them at once. A file Storage did not remove stayed listed until a super admin asked again or the member's next desk check.
- **The sweep.** `kyc-reopened-sweep`, an Edge Function pg_cron runs every five minutes with the scheduler's secret, exactly as the outbox consumers run (decision 0038; `private.schedule_outbox_consumer`). No new secret: the same `outbox_scheduler_secret` in Vault and `OUTBOX_SCHEDULER_SECRET` among the function secrets.
- **What it removes.** Only paths still listed ten minutes after their reopening (the console's own try has long finished), a hundred a run, oldest first, read with the service role through `reopened_kyc_files_to_sweep`; each lies in its member's folder (the table's check). A frozen venue's or member's stay listed, as they do for a super admin. Removed, they are forgotten (`forget_swept_kyc_files`); what Storage kept waits for the next run.
- It logs nothing and answers with counts alone. The practice venue's files are swept as the club's: nothing leaves the project.
- Locally, each checkout makes its own scheduler secret (`supabase/.scheduler-secret`, gitignored) for its functions, so a flow can run a scheduled function as pg_cron would. Vault holds no project address locally, so pg_cron itself still calls nothing.
