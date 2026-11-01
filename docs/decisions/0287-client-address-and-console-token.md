# 0287: The caller's address, and the console computer's token

Date: 1 Nov 2026. The audit of 28 Oct, C3b: A4-17 and A4-18.

- **The caller's address (A4-17).** Behind hosted Supabase, Cloudflare sets `cf-connecting-ip`, which a client cannot forge, and it comes first, as decision 0022 had it.
- **Without Cloudflare (the local stack)**, `private.request_ip()` and the device-pair and cage-agent functions now take the last `X-Forwarded-For` hop, the one the gateway added. Before, they took the first, which is whatever the client sent. This replaces 0022's fallback.
- **No address gives none.** The staff-network check refuses no address, and so does saving the networks.
- **The console computer's token (A4-18).** The enrolled computer's token stays in `localStorage`, accepted for now.
  - Any script injected into the console could read it. Off site the token alone is not enough, as the venue's network check still applies to it. A script running in an enrolled console on the venue's network has both, though, so the safeguards there are keeping such scripts out and revoking a computer on Devices.
  - Moving it to an HttpOnly cookie needs the console served from the API's own domain. That can be done later.
