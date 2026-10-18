# 0025 Sign-in codes are sent by the auth hook, not through the outbox

Date: 18 Oct 2026

CLAUDE.md rule 5 puts every external call in an outbox consumer. Sign-in codes cannot wait for one: Supabase Auth generates the code, calls its Send SMS hook, and waits for the hook to deliver before it tells the app the code is on its way. Through the outbox, a live sign-in code would also sit in `outbox_event`, readable by reports staff and kept for 30 days.

Decision: the hook, the Edge Function `auth-send-code`, is the one place outside an outbox consumer that calls an adapter, and it does nothing else.

- It checks Auth's Standard Webhooks signature.
- It sends the code with `sendSignInCode` from `@rivr/adapters`: the WhatsApp authentication template first, SMS when that fails.
- It never logs or stores the code or the phone.
- With no live channel configured it answers 503, so Auth refuses the sign-in instead of a fake pretending to send.

Test numbers never reach the hook: the local stack's `123456` (`supabase/config.template.toml`), and staging's private code (`docs/runbooks/ci-and-release.md`). Question #179 asks the owner to confirm.
