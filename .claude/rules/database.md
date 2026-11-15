---
paths:
  - "supabase/**"
  - "packages/db/**"
---

# Database

- Migrations are forward-only, timestamp-named, one concern each. A hook blocks edits to any migration already on `main`.
- Every new table: `venue_id`, `created_at`, `updated_at`, row-level security enabled with default deny, policies per role, and pgTAP tests for each policy including cross-venue isolation.
- Every policy and write function behind a member-facing feature calls `has_feature(member_id, key)`. Core features listed in the additions are never gated.
- Public surfaces read only `public_*` views that contain no personal data.
- Business events write one `outbox_event` row in the same transaction.
- Masked Aadhaar numbers only. Aadhaar photos carry the desk's bars while `kyc.aadhaar_covers` is on; while it is off (owner, 15 Nov, for now) they are kept as taken, readable by super admins only (decision 0663). KYC images in a private bucket with short-lived signed URLs.
- After a migration: `pnpm db:reset && pnpm db:types && pnpm test --filter db`.
- `packages/db` exposes typed query functions and query keys per feature; nothing else imports the Supabase client.
