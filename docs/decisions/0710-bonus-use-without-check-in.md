# 0710 Bonus used without a check-in

Date: 22 Nov 2026. The owner, 22 Nov: "Remove the check in requirement for bonus redemption at all places".

- **Where.** Use Bonus on a member's record and at the Door now goes through whether or not the member is checked in. At the Door it is on each member's first row in every list (in the room, expected, left), not only on those in the room. A seat's buy-in already checks the member in, so nothing changes there; Bonus from a file never needed a check-in (0707).
- **A use with a visit open** is that visit's, as before (0706): it counts with the seats' buy-ins against the visit's cap and shows on the visit's first row at the Door.
- **A use with no visit open** is tied to no visit, as a file's use is. It is never more than the Bonus in force, never while some is owed, and no more than the cap's share of the Bonus held then. It shows in the record's and the member's Bonus histories, Activity and the report's Bonus used, and in the Door's Wallet, but not as Used on a Door row, which shows a visit's uses.
- **Retries.** A request sent again is the same use, now known by its ledger key (`bonus_use:<id>`) rather than by having a visit, so a use with no visit is never taken for a file's.
- **Open.** Several uses with no visit are each held to the cap's share of what is held then; they do not add up against one visit. Asked in the question issue with 0709's points.
