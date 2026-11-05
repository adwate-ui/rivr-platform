# 0502: Check identity at the club

Date: 5 Nov 2026 · The owner's answers of 5 Nov · Builds on decisions 0197, 0271, 0298 and 0301

**Why.** Cashfree Secure ID will not be available. Production runs Cashfree's sandbox (decision 0421), which gives every member one test identity, so new sign-ups land in review as duplicates. The owner wants members to register today, in the app, with their identity checked by staff on the first visit.

**What.**
- **The switch.** `kyc.at_the_club` `{enabled}`, per venue, off unless set. Only a super admin changes it, with a reason, and the owner is alerted (a control setting). Settings → Floor, as "Identity (KYC) checked at the club" (moved from Members and rewards on the owner's word, 5 Nov, so it is found with the floor's rules and by "KYC").
- **On.** A new member takes a selfie in the app. It is kept as their sign-up photo (`photo.jpg`), with no vendor call, and `kyc_record.at_club_from` is stamped. The app lets them in (`KycGate`), and Tonight and Profile say what to bring. Seating, the cage and money stay on `private.is_kyc_complete`, so play waits for the desk check (`check_kyc_in_person`, by host, floor, admin or super admin), which shows the app selfie beside the camera.
- **The desk check is final while the switch is on.** It pays the verification bonus at once, at the amount in force on the **selfie day**, so pre-registering before 15 Nov keeps it. Its PAN recheck waits (`claim_kyc_rechecks`) and runs once the switch is off. A mismatch then goes to review, as before (decision 0271).
- **No vendor leftovers.** The desk check clears what a vendor left on the record (Aadhaar name, reference, identity key, address, vendor reference, scores). The sandbox's name never renames a real member, and its reference never clashes.
- **Members stuck on the sandbox.** While the switch is on, a super admin's **Reopen** (with a reason, audited) also takes a DigiLocker or PAN check that is waiting for review or refused as a duplicate. It clears the vendor's identity, keeps the selfie, and moves the check to the desk, stamped from the day the check began, so the member keeps the bonus of the day they registered. A verified check is never reopened, so the owner's own record is untouched. Whoever reopened a check never does the desk check that follows.
- **Off.** New sign-ups use Cashfree again. Members already let in keep the app and verify at the desk or in the app. Held rechecks run.
- **Practice venue.** The same path. Nothing reaches an external system, and no bonus is paid.
- **Not here.** Joining a waitlist before the desk check is PR 2 (`private.may_wait`), before 15 Nov.
