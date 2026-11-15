# 0662. A member's own photo is only a selfie they took

The owner, 15 Nov night: "Only keep the selfie as app photo because on-site photos are randomly taken by the staff." This supersedes part of decision 0588, which let a member see the photo the desk took of them once their check was verified.

- **The rule.** A member's own photo in the app (the header's circle and Profile) is only a selfie they took: the selfie their check points to, or else their sign-up `photo.jpg`. A photo the desk took (`in-person-<id>.jpg`) is never theirs to see, in any state of the check. Both `my_photo_path()` and the member's clause of `authorize_kyc_image` apply it (migration `20261121110000`).
- **With no selfie.** A member whose one photo is the desk's is told of none, and the app shows their initial, as it does for anyone with no photo.
- **Staff.** Staff see what they saw before: KYC review and the cage see the desk's photo, and the desk sees what it saw (pgTAP 419).
- **Nothing is deleted.** The desk's photos stay in the private `kyc` bucket as the check's record.
