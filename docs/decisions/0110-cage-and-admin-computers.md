# 0110: Cage and admin computers are known by a secret token, enforced where a venue has networks

Date: 2026-10-20 · Task: #384 (scope-v1 module 10; `.claude/rules/security.md`)

**Adding and enrolling a computer.** A device manager adds a computer on the console's Computers screen, as the cage or as an admin console, and gets a ten-minute code. Codes are by hash, as tablets' pairing codes are.

On that computer, staff at the venue (on its networks, once it has them) enter the code:
- The browser makes a 256-bit token and keeps it in local storage. It outlives sign-out, and nothing replaces it once enrolled.
- The browser sends the token as `x-rivr-computer` on every database call. Edge Functions don't receive it, since they name the headers they accept.
- The database stores only the token's SHA-256 hash.
- Five wrong codes in ten minutes stop that staff member for ten minutes.

This is not decision 0022's forgeable device id: only the browser holds the secret. The computer in use is never revoked from itself.

**The rule.** `private.venues_where`, which `has_permission` and every policy go through, adds it. At a venue whose `staff_ip_allowlist` is set (and never at the practice venue), these permissions need a computer of the right kind on those networks:
- **The cage's money permissions** (`cage.transact`, `cage.second_approve`, `markers.issue`, `withdrawals.approve`) need an enrolled cage computer.
- **The admin permissions** (settings, staff, devices, tiers, venue configuration, the kill switch, purge, the full export) need an enrolled admin console.

`can_grant_role` compares roles, not computers, so an admin can still give the admin role. A revoked computer, or one under an access revoke, stops at once. Realtime reads (no request headers) see no guarded rows at an enforcing venue; screens still poll.

**The address** is `private.request_ip()`: Cloudflare's `cf-connecting-ip`, or the first `X-Forwarded-For` entry when that is absent (the local stack).

**Saving the networks.** Until a venue has networks nothing is enforced, and the Computers screen says so to super admins. Networks are saved only from an enrolled admin console that is on one of them (RVNET), so whoever saves them can't shut every admin out.

**Break glass:** the owner clears `staff_ip_allowlist` in the Supabase SQL editor.

**Still to check after deploy (#416):** on staging, that `cf-connecting-ip` is present on every API request and a forged `X-Forwarded-For` is not believed (decision 0022).

**Idle lock.** The cage screens (the rail's money group) sign the cashier out after 10 idle minutes:
- the last activity is kept in local storage, so a reload past the limit locks at once;
- the first key after the limit locks rather than counting;
- another tab's activity counts too.
