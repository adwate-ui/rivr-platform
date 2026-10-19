# 0049 A TV pairs by the code it shows, and its request lives in private without a venue

Date: 19 Oct 2026. Task #49.

The additions say a TV shows a six-digit code and an admin types it into the console. That is the other way round from a dealer tablet (#41, decision 0045). A TV has a remote, not a keyboard, so it cannot type the console's code. From now on the console's code pairs dealer tablets only, so each kind of device has one way to pair.

How a TV pairs:
1. A TV that is not paired asks `device-pair` for a code (`start_tv_pairing`) and shows it. The reply also carries a 64-character secret that only the TV holds, in memory.
2. Staff with `devices.manage` type the code into the console with a name and a display mode (`claim_tv_pairing`). That enrols the TV as a device with its `tv_screen`.
3. The TV asks `device-pair` every few seconds with its secret (`check_tv_pairing`). The first ask after the claim gets the device's own login, exactly as a tablet gets one.
4. If that sign-in fails, an ask 30 seconds later gets a new login, which replaces the old one. Fifteen minutes after the claim, the secret gets nothing.

A request belongs to no venue until it is claimed, because the TV does not know where it is. So `private.tv_pairing` has no `venue_id`, like `private.device_pairing_miss`. No client role can read it, and only the service role and the security-definer functions write it.

Limits: `start_tv_pairing` refuses after thirty requests from one address in ten minutes (an IPv6 address counts by its /64), or two hundred from all. Thirty, because a venue's TVs share one address and each reload asks again. That keeps the number of live codes small against a million, so a code mistyped on the console is very unlikely to be a stranger's.

`device-pair` takes JSON only. A web page elsewhere could otherwise make its visitors' browsers use up the limits with plain-text POSTs, which need no CORS preflight.

A TV paired by mistake shows up on the console's list, where it can be unpaired. It reads only its own screen and the public views; the venue's dealer downs are for dealer tablets only.

Unpairing is revoking the device, as for a tablet. The TV reads `my_tv_screen` every few seconds. Once that returns nothing, it signs itself out and shows a new code. A TV holds nothing but its session.

Rejected:
- The tablet's direction (the console shows the code and the TV types it), which needs a keyboard on the TV.
- Polling the database directly with the anon role, which would grant signed-out callers a function.
