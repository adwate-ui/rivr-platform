# 0025 Sign-in codes are sent by the auth hook, not through the outbox

Date: 18 Oct 2026

CLAUDE.md rule 5 puts every external call in an outbox consumer. Sign-in codes cannot wait for one: Supabase Auth generates the code and waits for its Send SMS hook to deliver it. Through the outbox, a live code would also sit in `outbox_event` for 30 days, readable by reports staff.

Decision: the Edge Function `auth-send-code` is the one place outside an outbox consumer that calls an adapter, and it only sends sign-in codes (question #179 asks the owner to confirm).

- It checks Auth's Standard Webhooks signature; a signed call replayed within the five-minute window can only resend the same code to the same number.
- It sends to the number Auth is checking (`sms.phone`), never the account's current number, which during a phone change is the old one.
- `sendSignInCode` tries WhatsApp, then SMS on an immediate failure. A number not on WhatsApp fails only later (#181). WhatsApp gets 4 of Auth's 5 seconds, so an SMS fallback must fit the last one, and a slow WhatsApp may still deliver a second code.
- Expected failures go back as HTTP 200 with Auth's error object, the only body Auth reads; the app then sees 503, 429 or 502 and the message.
- It builds its adapters itself, not through `createAdapters` (0014): a sign-in belongs to no venue, and it must fail closed rather than fall back to fakes.
- A messaging stop does not halt sign-in codes, or the super admins who release it could not sign in.
- It never logs the code or the phone (Auth's own logs record the phone). Test numbers never reach it.
