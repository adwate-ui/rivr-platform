# 0045 A device signs in as itself with a pairing code, as a password-only +999 login

Date: 19 Oct 2026. Task #41.

A dealer tablet (and later a TV, #49) needs its own Auth login: `device.auth_user_id` and `current_device_id()` were built for it, and a staff member's login left on a shared tablet would carry their whole role. Staff with `devices.manage` add the tablet on the console and read out a six-digit code, valid for ten minutes and stored only as a hash. The tablet sends it, signed out, to the `device-pair` Edge Function, which redeems it (`redeem_device_pairing`, service role only), creates an Auth user with a random number in +999 (a country code no phone has) and a random password nobody keeps, links it (`link_device_login`), signs it in once as the server and returns the session.

A device login is password-only. The token hook checks for a device first: its login gets a token only by its password, only while the device is linked, not revoked and its access not revoked, never by a code. The Send SMS hook sends no code to a device login either. So a device login moved onto someone's phone is useless. Everyone else still needs a code sign-in. Revoking a device unlinks its login and frees its table at once, and a revoked device stays revoked (enrol it again), so nothing brings old sessions back.

Wrong codes are counted by the caller's address: five in ten minutes from one address, or fifty from all, and redemptions wait for the window, with an alert for the owner. CORS admits only the device apps' origins on hosted (locally Kong answers with `*`).

Rejected: anonymous sign-ins, which are off on purpose (`anonymous_users = 0`) and would give every throwaway session the `authenticated` role; email and password, which needs the email provider the runbook keeps off, because Auth records an email code as a code sign-in.
