# 0570. Bonus chips by hand for admins and the floor, tickets from a written note, a vendor's failure given back

Date: 9 Nov 2026. The owner's answers of 9 Nov. Supersedes the ticket rule of decisions 0165 and 0552.

**Bonus chips by hand.** Super admins, admins and floor managers add them, through a permission of their own, `bonus.give`, as cashiers give points but never bonus chips. Hosts and floor staff redeem bonus chips while seating, as before. With more people giving them, the owner's rule of 8 Nov holds: a reason in the audit log, never on one's own record, and a per-person daily limit with an alert, as points by hand have. Super admins have no limit, and only they change it. It starts at 10,000 bonus chips, the points limit's number, in Settings as Daily bonus chips limit: the owner gave no number for bonus chips, so it is theirs to change. Admins can still appoint Floor staff, as before; the owner now hears of each new login that can add bonus chips (`staff.role_granted`).

**A ticket opens only for a written note**, whatever the score. A rating of 3 or below with no note, or a detailed form with none, is no ticket and shows under Other. The owner still hears of a rating of 1 or 2 (decision 0301). The rule applies to what is already there: an open ticket with no note leaves the queue for Other, and a resolved one with no note moves there with its resolution.

**A vendor's failure gives the attempt back** (#791, point 4): a call that failed on the vendor's side does not use up one of the member's five a day. A call the vendor answered with a refusal still counts, and so does a DigiLocker pull that went through before its face match failed. Which failures are given back is in `@rivr/domain/identity`.
