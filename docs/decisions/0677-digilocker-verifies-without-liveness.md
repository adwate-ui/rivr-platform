# 0677 A DigiLocker match verifies at once with no liveness check

Date: 16 Nov 2026. The owner, answering #1024: "I had asked for liveliness check to be removed if zoop did not offer it." Supersedes decision 0675; decision 0400 stands as it was.

- **The rule.** Zoop has no liveness RIVR uses (decision 0671: the in-app selfie only, no Zoop page), so there is no liveness check at all. A DigiLocker check whose face matches the selfie, with a date of birth and a PAN or the identity key, is verified at once (decision 0400), whether or not a vendor scored the selfie for liveness.
- **What changes.** `20261122180000_digilocker_verifies_without_liveness.sql` re-creates `record_kyc_digilocker` without 0675's liveness gate, and `kyc_review_queue` and `list_spec`'s `kyc_review` source without the `no_liveness` reason. The console no longer knows that reason, and its copy is gone.
- **What still waits.** A face that is not the selfie's (`nothing_kept`), no date of birth (a year alone), a clash with another member, and a PAN check alone, as before.
- **Why 0675 was wrong.** It read #1024 as an open identity question and took the safest reading (staff review) although the owner had already ruled on liveness on 15 Nov. An owner's ruling is not reopened by a later question about it.
- **What this accepts.** Nothing but the face match stands between a photo of someone else's face and their DigiLocker; the owner chose that.
