# 0022 The audit log takes the client IP from cf-connecting-ip

Date: 18 Oct 2026

The security review found that `private.request_ip()` read the first `X-Forwarded-For` entry. That entry is whatever the client sends, so the audit log could record a forged address, and a later IP allowlist (cage and admin sessions, `.claude/rules/security.md`) could be bypassed with it.

Hosted Supabase sits behind Cloudflare, which overwrites `cf-connecting-ip` with the address it saw, and Supabase's own docs use that header for IP filtering ("Securing your API"). Decision: `request_ip()` reads `cf-connecting-ip` and falls back to the first `X-Forwarded-For` entry only when that header is absent, which happens on the local stack.

The audit log's device is now `private.current_device_id()`, the enrolled device signed in as the caller's login, instead of an `x-rivr-device-id` header the client could set to any id.

Lane A, when it builds the IP allowlist: check on staging that `cf-connecting-ip` is present on every request through the API gateway before relying on it.
