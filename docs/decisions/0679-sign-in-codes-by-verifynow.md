# 0679 Sign-in codes by SMS through Message Central's VerifyNow

Date: 16 Nov 2026. The owner: "Switch to using [Message Central's VerifyNow] for sending out OTPs." The Evolution WhatsApp bridge that carried every code (decision 0297) was down, and MSG91 (#181) was never set up.

- **Relay.** VerifyNow texts a code of its own on Message Central's registered template (no DLT of RIVR's own), so it cannot send Auth's code.
  - The Send SMS hook has VerifyNow text the member and keeps Auth's code, encrypted, with VerifyNow's check.
  - `sign-in-verify` gives Auth's code back for a code VerifyNow accepts, and the app signs in with it. The flow is in the adapters README.
- **Auth stays on the member's phone.** Auth limits sign-ins and verifies per address (30 per 5 minutes), and a function calling Auth would put every member behind one address. The CAPTCHA is unchanged.
- **Guards.** Five tries per code sent, within ten minutes. 30 checks per 5 minutes per caller address (IPv6 by /64), then 429 and an owner alert (`auth.sign_in_guessed`). The player and console origins only, JSON only.
- **Auth's code is ten digits** while it is relayed (`sms_otp_length`), with a 600-second expiry so it outlives the SMS. The hook refuses to relay a shorter code, and the WhatsApp path refuses a longer one, so a missed setting shows as sign-in down. The runbook's step 7a gives the order.
- **No cross-address cap:** one would let anyone lock the whole club out.
- **Left open:** someone polling one member's number can spend that member's tries, even from one address. The reply tells whether a code was asked for in the last ten minutes.
- **Test numbers** never reach the hook, so `sign-in-verify` tells the app to give Auth the typed code.
- **Switching:** VerifyNow is on while `MESSAGECENTRAL_CUSTOMER_ID` and `MESSAGECENTRAL_PASSWORD` are set; unset locally and in CI. The copy now says SMS.
- **Not done:** no fallback to WhatsApp when VerifyNow is down. The deploy's auth-config check doesn't check the length and expiry, because CI is frozen.
