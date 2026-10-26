# 0164: The door kiosk scans members in and out, and a visit's close pays playing-time promotions

Date: 2026-10-26 · Task: #331, owner request (26 Oct)

The owner asked that players scan in and out to claim bonuses and promotions that depend on playing time. They chose a door kiosk: a tablet at the door that scans the member's card.

**Pairing.** A door kiosk is a device of kind `door`. It is added on the console's Tablets screen with the Door kiosk switch, and pairs with a code as a dealer tablet does (#41). It runs the tablet app, which shows the card scanner in place of hand entry. A revoked kiosk is refused at once.

**Scanning.** The camera reads the card's rotating QR (decision 0162) with `jsqr` (Apache-2.0, no dependencies), because Android's WebView cannot be relied on for the browser's own barcode detection. A card scanner plugged in types into a field that holds the focus, as at the front desk.

**In and out.** The first scan checks the member in, and the visit records the kiosk. The next scan checks them out, under the front desk's rules: a member still seated, or owing call time, is refused with the reason. A scan within ten minutes of a visit closing (after a final cash-out at the cage, say) says goodbye and opens nothing.

**What the kiosk does not do.** It shows no list of who is in the room and checks nobody in by number. Those stay with the front desk on the console, because a screen facing players would show who is inside and let anyone check anyone in or out.

**Promotions.** A check-in weighs the check-in promotions. A visit's close, however it closes (door, final cash-out or end of day), weighs the hours-played promotions once. It uses the hours played that visit on the call-time clock (seated time, as points count it, decision 0161), the points those hours earned, and the table played longest, for its stake. Rules are weighed when the visit closes; question #445 asks how a time window should count. The deck gains a Four-hour bonus template: ₹1,000 bonus for a week, once a club day, after four hours at the tables.
