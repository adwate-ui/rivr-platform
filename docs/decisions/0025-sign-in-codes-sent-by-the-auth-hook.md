# 0025 Sign-in codes are sent by the auth hook, not through the outbox

Date: 18 Oct 2026

CLAUDE.md rule 5 puts every external call in an outbox consumer. Sign-in codes cannot wait for one: Supabase Auth generates the code, calls its Send SMS hook, and waits for the hook before telling the app the code is on its way. Through the outbox, a live code would also sit in `outbox_event` for 30 days, readable by reports staff.

Decision: the Edge Function `auth-send-code` is the one place outside an outbox consumer that calls an adapter, and it only sends sign-in codes.

- It checks Auth's Standard Webhooks signature. A signed call replayed within its five-minute window is accepted; it can only resend the same code to the same number.
- It sends to the number Auth is checking (`sms.phone`), never the account's current number. During a phone change the two differ, and the old number must not confirm the new one.
- It uses `sendSignInCode`: the WhatsApp authentication template, then SMS when WhatsApp fails at once. A number not on WhatsApp fails only later, so that case is #181. WhatsApp gives up after 4 of Auth's 5 seconds; a WhatsApp timeout may still deliver, so when SMS arrives a member could get two codes, and the SMS call must fit the remaining second.
- Expected failures go back as HTTP 200 with Auth's error object, because Auth reads no other body. The app receives 503 (no channel configured), 429 or 502, with the message.
- It builds its adapters itself rather than through `createAdapters` (decision 0014). A sign-in belongs to no venue, so the practice-venue rule does not apply, and it must fail closed rather than fall back to fakes.
- A messaging stop does not halt sign-in codes: halting them would also lock out the super admins who release it (question #179).
- It never logs the code or the phone. Auth's own logs do record the phone; that is Supabase's behaviour.

Test numbers never reach the hook. Question #179 asks the owner to confirm this exception.
