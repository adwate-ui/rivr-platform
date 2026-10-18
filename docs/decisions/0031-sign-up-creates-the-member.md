# 0031 Sign-up creates the member; the link's codes wait in the browser

Date: 18 Oct 2026. Task #10, question #211.

A number that signs in with a code and has no member record joins through `public.sign_up`: it gives the full name on its Aadhaar (KYC later checks DigiLocker's name against it) and becomes a member of the club's one real venue, never the practice venue, on the default tier. A number staff already registered links to that record as before and is not a sign-up. The KYC sign-up kill switch stops new sign-ups. KYC still gates every seat.

The link's codes (`ref`, `creator`, `utm_*`; `@rivr/contracts` `ATTRIBUTION_PARAMS`) are read when the player app opens and kept in that browser for 30 days, first touch, by `rememberAttribution` in `@rivr/db`; `useSignUp` sends them and forgets them. Sign-up happens in the browser the link opened in, and the app is installed after it (#16), so the codes never need to cross into the installed app, which on iPhone cannot read the browser's storage. Links from the website to the app carry the same query parameters (#9).

`sign_up_attribution` keeps the codes with the member, and `member.signed_up` carries them to lane D. A malformed code is dropped, never a reason to refuse a sign-up.
