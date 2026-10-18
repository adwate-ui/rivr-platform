# 0030 KYC takes the selfie first

Date: 18 Oct 2026. Task #5.

The selfie is the first step of KYC, before DigiLocker. The vendor checks it is a live person and searches the venue's face gallery for the same face. A passing selfie is stored in the private `kyc` bucket as the KYC photo (`<venue_id>/<member_id>/selfie.jpg`) and is never replaced once taken; a failing one is deleted.

Why first: DigiLocker's photo arrives as a short-lived link. Matching it against a selfie already stored means the document photo is used once and never kept (scope-v1: raw documents stay with the vendor). A selfie after DigiLocker would mean storing the Aadhaar photo or pulling DigiLocker twice.

A name or face that does not match DigiLocker's is someone else's documents: the check waits for staff and keeps none of that identity.

Duplicates of a verified member are refused: their PAN, their Aadhaar reference, or a face the gallery has under them. A clash with a check that is not verified refuses no one, since the first to arrive may be the impostor: the later check waits for staff. The Aadhaar reference is a stable token the vendor derives from the number (`DigiLockerRecord.aadhaarReference`), stored only as an HMAC under a key the database holds; four masked digits are not enough. The face search needs the vendor's 1:N gallery (`KycAdapter.enrolFace`), a requirement for the vendor contract. The member is told only to see the front desk, and cannot read the reason or the vendor's scores. Staff approval of a check under review (#31) must go through `private.settle_kyc`, so the gate still applies.

Under 18 on DigiLocker's date of birth is refused, and `private.is_kyc_complete` re-checks the age on the venue's calendar every time it is asked.
