# 0697: No WhatsApp on production

Date: 19 Nov 2026. The owner: "There will be no WA in production. SMS will continue", then "Switch it off".

- **Production:** the function secret `WHATSAPP_OFF=true` is set, and the WhatsApp secrets (the Evolution bridge's three, Meta's two) are unset.
  - Sign-in codes go by SMS through VerifyNow (decision 0679).
  - Members still get the app's push for a seat call, promotions and notices.
  - Owner alerts go by email (alert-email) and stay on the dashboard.
  - The welcome message and the Google review request are not sent there.
- **Switched off, not guessed:** with `WHATSAPP_OFF=true`, the `whatsapp` and `alert-whatsapp` consumers send through `whatsAppOff`, and the sign-in hook never uses WhatsApp. It takes each message and sends none.
  - Messages waiting when it is switched off are finished on the next run, unsent.
  - Nothing builds up in the outbox, and `check_silent_consumers` sees no silent consumer.
  - Missing secrets without the switch stay a fault, as before: the consumers answer 503 and deliveries wait. So a dropped secret on staging is seen, not swallowed (security review).
- **Staging** keeps WhatsApp for testing, set as in runbook step 6.
