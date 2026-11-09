# 0573. PAN and Aadhaar photos at the desk

Date: 9 Nov 2026. The owner's instruction, and answers to six questions the same day.

The desk check now keeps a photo of the whole PAN card and of the Aadhaar front, beside the member's face photo and the typed details, which stay as they were: full PAN and the last four Aadhaar digits. All three photos are needed before Verify. Members already verified are left as they are. This replaces the "photograph the face, never a document" line of the K-07 fix.

Photos are taken at the desk with the back camera of a phone or tablet (`DocumentCamera`), never in the member's app and never from a file. A computer, even with a webcam, hands over by QR code at the first photo.

The full Aadhaar number must never be kept. Bars go over the first eight digits and the QR code, placed from the card-shaped frame, and staff nudge them and confirm. They are burned into the JPEG on the device, so only the covered copy is uploaded. The server refuses an Aadhaar photo without that confirmation and records who gave it. There is no text recognition, so a wrong confirmation is not caught automatically; a super admin can send the photo back, and the member is then due at the desk for that photo alone.

Only super admins can open these photos, one at a time, each opening audited through the same `kyc-image-url` gateway as every KYC image. They go with the member on erasure.

A photo that is replaced, by a retake or by a reopened check done again, goes at once: after each check or retake the function clears every PAN or Aadhaar file in the member's folder that no row names, so a photo sent back for showing digits does not stay. Whoever sent a photo back does not also retake it.
