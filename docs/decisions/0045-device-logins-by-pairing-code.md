# 0045 A device signs in as itself with a pairing code, as a +999 phone login

Date: 19 Oct 2026. Task #41.

A dealer tablet (and later a TV, #49) needs its own Auth login: `device.auth_user_id` and `current_device_id()` were built for it, and a staff member's login left on a shared tablet would carry their whole role. Staff with `devices.manage` add the tablet on the console and read out a six-digit code, valid for ten minutes and stored only as a hash. The tablet sends it, signed out, to the `device-pair` Edge Function, which redeems it (`redeem_device_pairing`, service role only), creates an Auth user with a random number in +999 (a country code no phone has) and a random password nobody keeps, links it (`link_device_login`), signs it in once as the server and returns the session.

The token hook (#187) now also lets a password session through, but only for a paired device that is not revoked. A member or staff login with a password still gets no token. Revoking the device stops its next refresh at the hook and its reads at once (`current_device_id()`); pairing it again deletes the old login and its sessions.

Rejected: anonymous sign-ins, which are off on purpose (`anonymous_users = 0`) and would give every throwaway session the `authenticated` role; email and password, which needs the email provider the runbook keeps off, because Auth records an email code as a code sign-in. Wrong codes count against every live code, and five end them all: without a per-address limit that is the guard, and the cost of a guessing attack is a new code from the console.
