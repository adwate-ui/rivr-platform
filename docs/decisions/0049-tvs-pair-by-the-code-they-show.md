# 0049 A TV pairs by the code it shows, and its request lives in private without a venue

Date: 19 Oct 2026. Task #49.

The additions say a TV shows a six-digit code and an admin types it into the console, the other way round from a dealer tablet (#41, decision 0045). A TV has a remote, not a keyboard, so it cannot type the console's code. A TV that is not paired asks `device-pair` for a code (`start_tv_pairing`) and shows it; the reply also carries a 64-character secret that only the TV holds, in memory. Staff with `devices.manage` type the code into the console with a name and a display mode (`claim_tv_pairing`), which enrols the TV as a device with its `tv_screen`. The TV asks `device-pair` every few seconds with its secret (`check_tv_pairing`); the first ask after the claim gets the device's login, exactly as a tablet gets one, and later asks get nothing.

A request belongs to no venue until it is claimed, because the TV does not know where it is. So `private.tv_pairing` has no `venue_id`, like `private.device_pairing_miss`. No client role can read it, and only the service role and the security-definer functions write it. Thirty requests from one address in ten minutes, or two hundred from all, and `start_tv_pairing` refuses. Thirty, because a venue's TVs share one address and each reload asks again. That keeps the number of live codes small against a million, so a code mistyped on the console is very unlikely to be a stranger's. A stranger's TV paired by mistake would show up on the console's list, where it can be unpaired.

Unpairing is revoking the device, as for a tablet. The TV reads `my_tv_screen` every few seconds; once it reads nothing, it signs itself out and shows a new code. A TV holds nothing but its session.

Rejected: the tablet's direction (the console shows the code and the TV types it), which needs a keyboard on the TV; and polling the database directly with the anon role, which would grant signed-out callers a function.
