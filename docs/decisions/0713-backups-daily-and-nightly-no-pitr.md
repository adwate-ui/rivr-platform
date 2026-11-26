# 0713: Backups are Supabase's daily ones and the nightly copy, with no point-in-time recovery

Date: 26 Nov 2026. Go-live tracker G1 and G2; the owner's answer of 26 Nov: "I am on pro plan. Don't want to enable PITR because of its cost." This supersedes decision 0278 ("no backups for launch").

- **What there is.**
  - The org is on Pro, so Supabase keeps 7 daily backups of each project.
  - The nightly backup (decision 0072) runs for staging and production since 26 Nov. Each night it writes an encrypted dump, a CSV export and a copy of Storage's files to that target's R2 bucket. Nightly copies are kept for 35 days, monthly ones for 400, and production's bucket lock holds each night for its 35 days.
- **No point-in-time recovery**, by the owner's choice, because of its cost.
  - A restore goes back to the last daily or nightly backup, so up to about a day of changes can be lost.
  - Turning it on later needs no code change: Add-ons → Point in Time Recovery, on a compute size above Micro.
- **Held offline by the owner:** the backup key and each project's `kyc_reference_key` (runbook setup steps 3 and 4).
- **Drill.** The first drills passed on both targets on 26 Nov (#1142, the runbook's drill log). From here the drill runs monthly, with `--auth-version`.
- **Personal data.** Backups now exist, so the privacy notice's "up to 400 days" describes what is kept.
