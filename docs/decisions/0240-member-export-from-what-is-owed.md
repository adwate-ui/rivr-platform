# 0240: A member's own export gives what a member is owed; staff notes apart; other members blank

Date: 2026-10-27 · Task: #498 · Question: #493 X5 (the owner's answer of 27 Oct)

**Why.** The member export (#103, decision 0232) took every column of every table naming the member. It carried staff notes about them (freeze and override reasons, KYC review reasons, the credit proposal's reason, face-match details) and other members' ids (the other side of a bad beat), which the owner removed by hand before sending.

**What.** `private.member_export_columns()` lists every column of every table naming a member, with what the export does:
- **owed:** given as it is.
- **note:** a staff note, given in a separate `staff-notes/<table>.csv`, with the row's id to join it by. The owner decides whether to send it.
- **other:** another member's id, given only where it is this member's own; otherwise blank. Of a bad beat's table, only the member.
- **withheld:** never given (another member's face match, the entry a bounty came from).

A column not listed is withheld, and `151_member_export` fails until every column of such a table is listed, so a new column is a decision. The full archive is unchanged: every column of every table.

**Notes today:** control reasons, credit reasons, an early departure's override reason, a feedback ticket's resolution, a jackpot's reason, KYC liveness and face-match scores and refusal, a KYC review's reason, feature override reasons and tier change reasons. A reason the member was told (a declined withdrawal, a turned-down payout account, why they left a waitlist) is owed.
