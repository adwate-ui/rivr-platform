# 0115: Cage receipts print from the cage computer's browser

Date: 2026-10-20 · Task: #69 (the owner's answer to #412: the browser does it)

After a buy-in or a cash-out, the cage offers Print receipt. It prints the transaction's thermal receipt on the printer the cage computer prints to: the thermal printer at the cage, set up as that computer's default.

`@rivr/ui`'s `PrintSheet` holds what is printed. It stays off the screen, and while one is on the page, printing leaves out everything else (`styles.css`).

The receipt is `@rivr/ui`'s `ThermalReceipt`, moved from `@rivr/render` so the cage and the renderer draw the same one, 576 px wide, one CSS pixel to a printer dot at 80 mm. It shows:
- the club's legal name, address and GSTIN, which every staff member may read;
- when, in IST;
- the member and what happened;
- the amount;
- the first eight characters of the cage transaction as its reference.

There is no receipt-printer adapter or server render for now, so the acceptance's "the practice venue prints through the fake" is met this way: a practice receipt says "Practice receipt. No money changed hands."
