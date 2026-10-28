# 0265: Glaza's statement comes from the month's latest import

Date: 28 Oct 2026. Issue #109; question #580.

- Staff who run F&B import Glaza's CSV for a club month. Its first line names the columns: time (IST), table, seat, item, kind (food, soft_drink, alcohol), quantity, unit cost and unit price in rupees, and comp (yes or no). If Glaza's export differs, only the console's reader changes.
- Each line is matched to a visit by table and time: the club's table of that name, and the one seat session there at that time. The seat, when Glaza has it, tells players at the same table apart. A line with no such table, nobody seated, or more than one player and no seat stays unmatched, and the statement shows how many matched.
- Everything RIVR comped (food, soft drinks and alcohol) is owed to Glaza at cost. The margin on alcohol sold is split 50:50; RIVR's half is rounded toward nothing to the paisa, so Glaza keeps an odd paisa. NewCo's payable is the comps less RIVR's half, and below nothing Glaza owes RIVR. This is the safest reading of #580 until the owner answers.
- A month's statement reads its latest import, so a corrected file stands in for the first. Earlier imports are kept, not deleted.
- The rule is `glazaPayable` in `@rivr/domain`, proved with its SQL twin `private.glaza_payable` on `packages/testing/golden/glaza.json`.
