# 0277: The nightly render job keeps the service-role key

Date: 28 Oct 2026. Issue #596, from the security review of batch 17 (#155).

- **What it does.** `render:offline-packs` reads the offline packs and winner cards, reads player names, uploads to the `offline-packs` and `winner-cards` buckets, and removes images no card names. It runs from `.github/workflows/offline-pack.yml` with the service-role key, which it reads at run time from the Supabase API and masks. The key is never stored.
- **Accepted, not narrowed.** The job runs in the target's deploy environment, which only `main` can use. That environment already holds the Supabase access token, and the token can do more than the key: deploy, set secrets, read every key. A scoped Edge Function with its own secret would add a function and a secret, and lower nothing an attacker who reached that environment could already do.
- **Revisit when** the job runs anywhere but a main-only deploy environment, or the access token leaves that environment. Then move the job behind an Edge Function that can only read the pack and card rows and write the two buckets.
