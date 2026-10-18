# 0035 How a KYC reviewer decides a check

Date: 18 Oct 2026. Task #31. Amends decision 0030.

A check waits for staff (`needs_review`) when the vendor cannot finish it alone: a PAN alone (#198); a DigiLocker record in another name or with another face, whose details were never kept (decision 0030); or a PAN, Aadhaar reference or face that another unfinished check also holds. The queue says which. A KYC reviewer (`kyc.review`) at the venue approves or rejects it with a reason, in `public.review_kyc`, never their own check: not their member record, nor a member with the phone or name of one of their staff records.

- **Approving** goes through `private.settle_kyc`, the one way any check is verified (decision 0030), now with a `reviewed` flag: the reviewer has weighed a clash with another unfinished check, so that alone no longer holds it back. The gate still refuses under 18 and any PAN, Aadhaar reference or face a verified member holds, and a face match now counts both ways. One check settles at a time per venue.
- Approving needs the **date of birth and the PAN**. Where the check kept none, the reviewer enters them from the original documents at the club, so the gate always has a PAN to look for duplicates by. `kyc_review` records that they did. A second reviewer for a typed date of birth is not required yet.
- **Rejecting** refuses the check (`staff_rejected`). A refused check never restarts, as before.
- The **KYC sign-up kill switch** stops approvals; rejections still go through.
- Every decision is a row in `kyc_review`. The **reason** is the reviewer's words: it may hold no document number (the database refuses twelve digits or a PAN's shape), and the audit log keeps the decision without the reason, since the log outlives an erasure request. Purge (lane A) must remove a member's `kyc_review` rows.
- Checks a vendor could not start at all (no vendor live on a real venue) are question #235, not this queue.
