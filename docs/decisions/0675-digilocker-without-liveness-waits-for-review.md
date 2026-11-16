# 0675 A DigiLocker match with no liveness check waits for a reviewer

**Superseded by decision 0677 (16 Nov 2026):** the owner had ruled there is no liveness check; a DigiLocker match verifies at once.

Date: 16 Nov 2026. Question #1024, unanswered: this is its safest reading (CLAUDE.md: identity, safest reading, continue). Amends decision 0400 ("verified at once") for selfies no vendor checked for liveness. Decision 0671 is why there is none: Zoop has no liveness RIVR uses (the owner, 15 Nov: keep the in-app selfie, no Zoop page).

- **The gap.** Without liveness, someone who can open another person's DigiLocker can take the "selfie" of that person's photo, and the face match passes. Nothing else stops it.
- **Now.** `record_kyc_digilocker` verifies at once only when the selfie has a liveness score (read with the row locked). A match whose selfie has none (`liveness_score` null, as Zoop's selfie step stores it) is `needs_review`, with what DigiLocker gave kept for the reviewer (migration `20261122150000_digilocker_without_liveness_waits.sql`).
- **What the reviewer does.** The queue gives `no_liveness`, both `kyc_review_queue` and the console's page of it (`list_spec('kyc_review')`, which repeats the reasons). The console says "No liveness check on the selfie. Approve only after seeing the member in person." Comparing photos would not catch it: the DigiLocker photo is not kept, and a photo of a photo matches it by construction. Whether such checks should go to the desk instead is #1024's to decide.
- **Unchanged.** A selfie a vendor checked for liveness (the practice venue's fake; Cashfree's before) verifies at once. A face that is not the selfie's waits as before, keeping nothing.
- **Cost.** Every in-app check on Zoop waits for staff until #1024 is answered otherwise. Not reachable while `kyc.at_the_club` is on, nor before DigiLocker on Zoop is built (#1023).
- **The reason shows only when it is the reason.** `no_liveness` is given to a DigiLocker check with no liveness score that has a PAN or an identity key, so would otherwise have verified; a clash, or a missing date of birth, shows its own reason first.
- **Left as is.** `record_kyc_pan` verifies a `needs_pan` DigiLocker check without looking at liveness. No new check reaches that state (a failed DigiLocker becomes `method = 'pan'`): only seed rows (the practice and e2e members) and checks from before Zoop, which had Cashfree's liveness; production's were deleted on 12 Nov.
