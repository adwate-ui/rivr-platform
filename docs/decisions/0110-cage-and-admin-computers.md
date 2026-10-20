# 0110: Cage and admin computers are known by a secret token, enforced where a venue has networks

Date: 2026-10-20 · Task: #384 (scope-v1 module 10; `.claude/rules/security.md`)

A device manager enrols a computer on the console's Computers screen as the cage or as an admin console. The browser makes a 256-bit token, keeps it in local storage (it outlives sign-out), and sends it as `x-rivr-computer` on every database call. Edge Functions don't receive it, since they name the headers they accept. The database stores only the SHA-256 hash. This is not decision 0022's forgeable device id: only the browser holds the secret.

`private.venues_where`, which `has_permission` and every policy go through, adds the rule. At a venue whose `staff_ip_allowlist` is set (and never at the practice venue), these permissions need a computer of the right kind on those networks:
- **The cage's money permissions** (`cage.transact`, `cage.second_approve`, `markers.issue`, `withdrawals.approve`) need an enrolled cage computer.
- **The admin permissions** (settings, staff, devices, tiers, venue configuration, the kill switch, purge, the full export) need an enrolled admin console.

The address is `private.request_ip()`: Cloudflare's `cf-connecting-ip`, or the first `X-Forwarded-For` entry when that is absent (the local stack). A revoked computer, or one under an access revoke, stops at once. Until a venue has networks nothing is enforced, and the Computers screen says so to super admins. Realtime reads (no request headers) see no guarded rows at an enforcing venue; screens still poll.

**Break glass:** if every admin console is lost, the owner clears `staff_ip_allowlist` in the Supabase SQL editor.

**Still to check:** on staging, that `cf-connecting-ip` is present on every API request (decision 0022). That needs staging, so it is not part of this change.

The cage screens (the rail's money group) sign the cashier out after 10 idle minutes. The last activity is kept in local storage, so a reload past the limit locks at once.
