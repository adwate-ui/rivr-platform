# 0707 Bonus added and used from a file

Date: 22 Nov 2026. The owner's request, 22 Nov ("Allow for adding a CSV/xlsx upload for bonus addition and redemption"), and their answers to four questions.

- **Who.** Super admins only, from "Bonus from a file" beside Export on Members. The cap on one Bonus by hand and the daily limit don't bind them (#996), so no line is capped.
- **File.** CSV or .xlsx (first sheet), read in the browser and sent nowhere until Save. Columns are found by heading: member (member number or 10-digit mobile), type (Add or Use), chips (whole 50s, 50 to 1,00,000) and reason (3 to 200 characters). 500 lines and 1 MB at most.
- **Preview, then all or none.** Every line shows with the member's name and number, or what is wrong. Save is offered only when every line is right. `bonus_from_file` runs the lines in the file's order in one transaction, and any refusal undoes the file and names its line. The same request id again changes nothing.
- **An Add** is Bonus by hand (`credit_bonus`, key `bonus.hand:file:<file>:<n>`): the usual expiry, owed paid first, the member told. Reports count and list it as by hand.
- **A Use** needs no check-in and no visit cap. It is a `bonus_redemption` with no seat and no visit, so it is not on the Door or in Players visits. It is never more than the Bonus in force and never while any is owed. An Add above it in the file counts. The member is told, with no table.
- **Audit.** Each line is `bonus.file` with `added_chips` or `used_chips`. A member's History shows one change per file with both figures, as one save writes at one moment.
- **Rule and twin.** `bonusFileRun` in `@rivr/domain/bonus` (golden `bonusFile.json`) runs the preview. The database runs the same order with `bonus_pay_off` and `bonus_draws`, already proved on `bonus.json`; pgTAP 597 proves the sequence.
