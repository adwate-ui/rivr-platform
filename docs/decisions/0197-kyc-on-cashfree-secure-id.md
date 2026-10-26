# 0197: KYC runs on Cashfree Secure ID; duplicates by a frozen name, date of birth and last four digits

Date: 2026-10-26 · Task: #474 (the owner: "Just use Cashfree for everything. If Cashfree does not support it, then skip that feature in KYC flow.")

**Vendor.** `createCashfreeKyc` does DigiLocker (Aadhaar and PAN), the PAN check with name *and* date-of-birth match, liveness, and the 1:1 match with the Aadhaar photo. The last two take image files, so the adapter fetches the selfie's signed link and DigiLocker's base64 photo and sends the bytes. A real venue gets it when four function secrets are set: `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_ENVIRONMENT` and `CASHFREE_PUBLIC_KEY`. Without them, KYC stays closed (decision 0014). The practice venue keeps the fake.

**Signed calls.** Edge Functions have no fixed address, so the account's second factor is its Public Key. `shared/cashfree.ts` signs each call (`x-cf-signature`: RSA-OAEP SHA-1 of `clientId.unixSeconds`) for KYC and payouts (#475) alike. It accepts a DigiLocker link only on https and a `cashfree.com` host.

**Skipped, as Cashfree has none.** The face search (`enrolFace`) is gone; `same_face_as` stays for older checks. Cashfree gives no stable Aadhaar reference, so instead (the owner's choice) `kycIdentityKey` builds a key from DigiLocker's name (read as the name match reads it), date of birth and last four digits. The database keeps it as a keyed hash, frozen at the check, so neither punctuation nor a later rename dodges it. A clash with another member's check holds for a KYC reviewer and never refuses, since two people can share all three.

**Testing.** TEST keys against `sandbox.cashfree.com` only, which answers Cashfree's published values. The seed's John Doe (`919000000612`) is that test PAN's person (runbook ci-and-release, step 8). Staging's real venue uses the sandbox, so the e2e proves "fails closed" locally only.
