# 0663. The Aadhaar bars are a venue setting, off for now

The owner, 15 Nov night: "Remove the black box requirement for staff (temp issue) but slowing down staff." Decision 0573 had the desk place the Aadhaar front under bars over its first eight digits and QR code, and say so, before the photo was kept.

- **The setting.** `kyc.aadhaar_covers`, a venue setting through `setting_key` (migration `20261121120000`). None set is off. Only a super admin changes it, with a reason, and the owner is alerted, as for `kyc.at_the_club`. Turned on, the bars and the word come back with no deploy.
- **While off.** The desk's camera shows no bars and asks for no word; a retake of the Aadhaar front is the same. The database asks for the word only while the setting is on, and keeps no one's word on bars while it is off.
- **The photos are stored unmasked while it is off.** The bars were painted into the picture on the device, so only the covered copy left it; now the whole card does, all twelve digits and the QR code. The typed record still keeps the last four digits only (`XXXX XXXX 1234`).
- **Who sees them.** Unchanged: PAN and Aadhaar photos open for super admins alone, each opening audited (`authorize_kyc_image`; pgTAP 502).
- **Risk, for the owner.** UIDAI's rules expect a kept copy of an Aadhaar to hide the first eight digits. This is accepted as temporary; turning the setting on ends it for new photos, and photos taken while it was off stay unmasked until retaken.
- **"Digits showing"** was never a fixed reason: a super admin types why a photo is sent back. The tests used it as their example and now use another.
