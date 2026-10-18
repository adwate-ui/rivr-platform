# 0035 How a KYC reviewer decides a check

Date: 18 Oct 2026. Task #31.

A check waits for staff (`needs_review`) when the vendor cannot finish it alone: a PAN alone (#198); a DigiLocker record in another name or with another face, whose details were never kept (decision 0030); or a PAN, Aadhaar reference or face that another unfinished check also holds. A KYC reviewer (`kyc.review`) at the venue approves or rejects it with a reason, in `public.review_kyc`, never their own check.

- **Approving** needs the date of birth from the documents. Where the vendor's was not kept, the reviewer enters the one on the original document they hold at the club; `kyc_review.entered_date_of_birth` records that they did. A clash with another unfinished check is what the reviewer weighs, so it does not hold the check back. The gate still does: under 18, or a PAN, Aadhaar reference or face a verified member holds, is refused whatever the reviewer decides (`private.kyc_refusal`, as `settle_kyc` uses).
- **Rejecting** refuses the check (`staff_rejected`). A refused check never restarts, as before.
- Every decision is a row in `kyc_review` (who, what, why, where the check ended), which the audit log records. The reason is the reviewer's words; the screen asks for no document numbers.
- Checks a vendor could not start at all (no vendor live on a real venue) are question #235, not this queue.
