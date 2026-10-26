# 0230: Unclaimed balances are cash or bonus untouched, by money or visit, for the venue's period

Date: 2026-10-26 · Task: #110 (scope-v1 S-D1, "unclaimed-balance reporting")

The report lists the members who hold cash or bonus with the club (`member.cash`, `member.bonus` above zero) and have neither moved money nor visited for the venue's period. Money moved means the member's own: their cash, or a marker repaid. A bonus expiring or granted to them is the club's doing and does not count. A visit means a door visit opened. A member who did neither is seen when they joined. The quietest come first.

- **Period.** The setting `reports.unclaimed_days` (30 to 3,650), a year unless the venue sets it. Neither the spec nor the issue names a period, so a year stands until the owner sets one on Settings.
- **Who.** Staff who read reports (`reports.read`), on the console's Reports screen, beneath the month's MIS. The table exports, as every console table does (#102).
- **What it is not.** It reports and does nothing more: no forfeiture, no message to the member. What the club does with an unclaimed balance is the owner's and the CA's call.
