# 0678 When Zoop does not verify a member, the desk does

Date: 16 Nov 2026. The owner: when Zoop is unsuccessful, the check "should default to the floor path, like the switch" (`kyc.at_the_club`, decision 0502). Replaces the PAN step after a failed DigiLocker (decision 0320's fallback), whose PAN alone always waited for a KYC reviewer with the member kept out of the app.

- **What sends a check to the desk, and the reason kept for it** (`kyc_record.desk_reason`):
  - `face_unconfirmed`: the face match said it is not the selfie's face (Zoop's score kept), or Zoop refused the match outright;
  - `no_date_of_birth`: the Aadhaar gives the year of birth alone;
  - `digilocker_failed`: DigiLocker refused, abandoned, unreadable or without an Aadhaar, or nothing delivered 35 minutes after the start (decision 0676);
  - `not_started`: Zoop could not start the hand-off at all (down, refusing, or no keys at the venue: the no-vendor adapter now checks no liveness, so the selfie is kept and the start sends the check here).
  A Zoop outage while the member waits for the delivery is still asked again.
- **What it means.** `record_kyc_digilocker_failed` keeps the check `started` and marks it for the desk (`at_club_from`), ending the DigiLocker session and anything delivered for it. As with the switch on, the member sees "Registered" and what to bring, is let into the app, may join a waitlist (decision 0503), and the floor checks them in person; seating still needs a verified check.
- **The desk is warned** (the security review of #1039). A face the app could not confirm is Zoop's one sign of someone using another person's documents. The desk's search and its list for tonight carry the reason, and the check in person shows "The app's face check did not match this member to their Aadhaar photo…" on its first step and again before Verify. A later, weaker failure never replaces `face_unconfirmed`; the reason goes once the check is decided. Whether such a check should need a KYC reviewer rather than any desk staff is the owner's to say.
- **The app's own check stays offered.** With the switch off, the Registered screen also offers "Verify in the app instead" (DigiLocker again). The desk is the default.
- **What does not change.** A duplicate identity or under 18 is refused, and a clash waits for a reviewer.
- **Checks held for a PAN.** The migration moves every `needs_pan` check to the desk (`digilocker_failed`), keeping nothing from the attempt (none on production on 16 Nov; staging's are test members). The PAN step remains only for such checks made before it; removing it is a follow-up.
