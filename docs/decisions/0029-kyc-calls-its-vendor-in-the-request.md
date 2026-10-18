# 0029 KYC calls its vendor inside the request

Date: 18 Oct 2026. Task: #4.

CLAUDE.md rule 5 sends every external call through an outbox consumer, and decision 0025 made the sign-in hook the one exception. KYC is a second one: DigiLocker is a hand-off the member is waiting on (start, consent at DigiLocker, return), and a PAN check answers while they look at the screen. Queueing either would leave the member on a spinner.

Decision: the `kyc` Edge Function calls the KYC adapter directly, and nothing else. Before any vendor call it passes `begin_kyc_vendor_call`: the `kyc_signup` kill switch and member or venue freezes, the member's `kyc_verification` consent, and five paid calls a day. Where DigiLocker returns the member is fixed by the function (`PLAYER_APP_URL`), never by the request. The practice venue gets the fake vendor; a real venue without keys fails closed (0014). The record keeps the masked Aadhaar, PAN, date of birth, address and vendor reference; the audit log keeps only how the check moved.

A PAN alone (DigiLocker failed) ends in `needs_review`, not `verified`: there is no DigiLocker photo for the face match (#5), and the date of birth is the member's own. Question #198 asks the owner to confirm.
