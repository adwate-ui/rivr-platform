# 0710 Bonus used without a check-in

Date: 22 Nov 2026. The owner, 22 Nov: "Remove the check in requirement for bonus redemption at all places".

- **Where.** Use Bonus on a member's record and at the Door now goes through whether or not the member is checked in. At the Door it is on each member's first row in every list (in the room, expected, left), not only on those in the room. A seat's buy-in already checks the member in, so nothing changes there; Bonus from a file never needed a check-in (0707).
- **A use with a visit open** is that visit's, as before (0706): it counts with the seats' buy-ins against the visit's cap and shows on the visit's first row at the Door.
- **A use with no visit open** is tied to no visit, as a file's use is. It is never more than the Bonus in force, never while some is owed, and no more than the cap's share of the Bonus held then. It shows in the record's and the member's Bonus histories, Activity and the report's Bonus used, and in the Door's Wallet, but not as Used on a Door row, which shows a visit's uses.
- **Retries.** A request sent again is the same use, now known by its ledger key (`bonus_use:<id>`) rather than by having a visit, so a use with no visit is never taken for a file's; a file's use is known by its own key (`bonus_file_use:<id>`) too.
- **The cap with no visit (the owner's answer, #1126).** Each use with no visit is checked on its own against the cap's share of the Bonus held then; such uses do not add up per club day.
- **Breaks.** A member on a break uses no Bonus (decision 0053, RVBRK). Check-in refused them, and a use needed one; now Use Bonus refuses them itself, which also covers a break taken during a visit. A file's Use lines are #1130.
- **The Door** offers Use Bonus only where the wallet holds some and the member is not erased, so it never offers what would be refused.
