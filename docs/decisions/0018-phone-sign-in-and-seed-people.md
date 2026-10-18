# 0018 Everyone signs in by phone; the seed holds no passwords

Date: 18 Oct 2026

The seed runs on local stacks and on staging, and the repository is public. Seed users with passwords would publish working staging logins, including super admins.

Decision: members and staff sign in with a mobile number and a one-time code. Seed people have phone numbers and no password. Local stacks accept code 123456 for the seed numbers through `[auth.sms.test_otp]` in `supabase/config.template.toml`, which is never used on hosted projects; staging sets its own test numbers in the dashboard if needed. Auth requires an SMS provider to be configured even for test numbers, so the local template configures Twilio with placeholder values that are never called.

Device binding, the IP allowlist for cage and admin, the 10-minute cage timeout and dealer PINs on the tablet sit on top of this (lanes A and B). Production SMS goes through the SMS adapter (lane C).
