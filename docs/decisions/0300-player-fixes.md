# 0300: The player app's fixes from the owner's walk

Date: 2 Nov 2026. The owner's list after the staging walks (player and pre-registration sections).

- **"You are number null".** A waiting place from an earlier night was never closed: Home and the floor list counted it, while the ranking only ranks tonight's places, so its number was empty. A place now belongs to the night it was made: the every-minute job closes older ones as `night_ended`, and `my_waitlist`, `waitlist_lengths` and `waitlist_requests` read tonight's only. Places already stale were closed once.
- **Join only on open tables.** A closed table shows no Join and no "Ask to open". There is no Join either while the member is on a list, seated, or on a break, which the club would refuse anyway.
- **The seat card.** It says "Playing since 21:40" and how long, the call time left, and "Minimum session" (the call time given at seating). "Add 1 h" works throughout the session (the owner's answer of 2 Nov): the new call time is the later of the current call time and the minutes played, plus an hour, capped at 24 hours (`extendedCallTimeMinutes`, `@rivr/domain/callTime`, mirrored in `extend_my_call_time`).
- **No Step away.** The player's Step away is gone; the floor's Hold place (decision 0299) holds a place instead.
- **The push banner.** One compact line, "Get seat calls on this phone." with Turn on and a close button.
- **The selfie on the card.** The membership card shows the member's KYC selfie once their check is verified and the image is kept (`my_membership_card.photo_path`). It is the only KYC image a member may see: `authorize_kyc_image` lets a member see their own verified selfie through the same one-minute signed link staff use, and audits each view. Document images, another member's selfie and a selfie still under review stay staff-only. A name of three lines leaves the photo little room; the player redesign under way moves the QR off the card.
