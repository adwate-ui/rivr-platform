# 0297: WhatsApp through the Evolution bridge, for now

Date: 2 Nov 2026. The owner: "We will use Evolution to send WA messages (including OTP) for now", as Maneman does (its decision 0016).

- **What sends.** `createWhatsAppEvolution` (`@rivr/adapters/whatsapp`) posts each message as plain text to the bridge, `POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE_NAME}` with the `apikey` header. The text is the template's own from `WHATSAPP_TEMPLATES` with its parameters filled in, so one list still holds every message; the sign-in code joins it as `sign_in_code`.
- **Which WhatsApp.** `supabase/functions/_shared/whatsapp.ts` picks the bridge while its three secrets are set, else Meta's Cloud API once its two are. Moving to Meta later is unsetting the bridge's secrets; no code changes.
- **Staging's fence.** With `WHATSAPP_ALLOWLIST` set, the seat call, promotions, review requests and the owner's alerts go only to the numbers on it, so the seed's made-up members never reach a stranger. Production leaves it unset. Sign-in codes are not fenced: a code goes to the phone that asked for it.
- **What the bridge cannot do.** A link button has no plain-text form, so the receipt and payment-link messages are refused; neither is sent since decision 0284.
- **The risk, as Maneman records it.** The bridge drives a WhatsApp account the way WhatsApp Web does. The number can be banned for automated sending, and then no code goes out until SMS (MSG91) or Meta's Cloud API is set. RIVR should send from a number of its own, not Maneman's or poker-settle's.
