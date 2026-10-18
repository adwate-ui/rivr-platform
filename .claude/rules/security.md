---
paths:
  - "supabase/**"
  - "packages/db/**"
  - "packages/adapters/**"
  - "apps/console/src/features/admin/**"
---

# Security

- The service-role key exists only in Edge Functions and CI. Never in an app.
- Staff sessions carry role, device and IP; cage and admin need an enrolled device and an allowlisted IP; cage times out after 10 minutes idle.
- Rate limits on OTP, login, withdrawal, marker and purge endpoints.
- Webhooks verify signatures. Secrets in Supabase vault and GitHub secrets.
- No personal data in logs, Sentry events or public views.
- Purge is callable only by `super_admin`, checked in the database function, and writes to the audit log.
