---
paths:
  - "supabase/**"
  - "packages/db/**"
  - "packages/adapters/**"
  - "apps/console/src/features/admin/**"
---

# Security

- The service-role key exists only in Edge Functions and CI. Never in an app.
- A staff session ends only when someone signs out or loses access (decision 0660); there is no idle sign-out (owner, 15 Nov).
- Rate limits on OTP and login endpoints.
- Webhooks verify signatures. Secrets in Supabase vault and GitHub secrets.
- No personal data in logs, Sentry events or public views.
