# 0583. The trial run's identity fixes

The trial run, 13 Nov, left two members wrongly verified (#919, #920, #921). The owner, 15 Nov: "Fix all of these issues."

- **No vendor call while the desk checks identity.** A phone still running the app from before the club-desk switch (decision 0502) sent its member through the vendor, whose sandbox verified them under its test identity. Only the screen kept to the switch. Now `begin_kyc_vendor_call`, which every vendor call passes, refuses while `kyc.at_the_club` is on (RVKIL, which every app version reads as "stopped"). Production's sandbox keys were also removed, so the vendor stays closed until live keys are set.
- **A verified desk check can be reopened.** The desk picked one member and entered another's documents, and the second member was then refused as a duplicate for ever. A super admin reopens a verified check done in person, with a reason. What the desk entered is cleared: the date of birth, the Aadhaar digits, the PAN, the photo and the documents. The member waits for the desk again.
  - Never their own check, and whoever reopened does not do the check that follows, as for a refused one.
  - A check the vendor verified stays: nobody typed it.
  - A verification bonus already paid stays paid; its key stops a second.
  - The files (the face photo and the two documents) stay in the member's folder until their next desk check, which clears whatever the check no longer names. No screen lists them meanwhile. Clearing them at the reopening itself is #931.
  - While the club checks identity at the desk, the member stays let into the app.
- **Who holds a duplicate.** Where a check is refused as a duplicate, staff who check members see which member holds the documents (`kyc_duplicate_holder`), so a check saved on the wrong member is seen at the desk.
- **Stray document files are cleared.** The clearing of decision 0573 never ran: the server's role could not read `kyc_document`. It now reads `member_id` and `path`, nothing else.
