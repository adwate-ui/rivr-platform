# 0065: The cage refuses with the reason an identity check fails; a cash-out on a break goes ahead

Date: 2026-10-20 · Task: #58

Every cage write that moves money (buy-in, marker, cash-out) refuses a member whose identity check is
not complete, now with its reason, in the KYC review's own words: under the venue's minimum age
(`RVAGE`), the PAN, Aadhaar or face of another verified member (`RVDUP`), or simply not finished
(`RVKYC`). A frozen member is refused as frozen first (`RVMBR`). The cage's member search carries the
reason, so the cashier sees it before trying.

#58's acceptance also lists a self-excluded member for the cash-out. The prototype lets one cash out
(its cage refuses buy-ins and markers during a break, never a cash-out), and refusing would keep a
member's own money at the club when they have chosen to stop playing. So buy-ins and markers refuse a
break (`RVBRK`, as since #56), and a cash-out does not. The owner is asked in #364.

The cage's withdrawals and deposits show the member's KYC photo. Academy payments do not: they pay
for a course, not chips or a balance, so they stay as #34 built them.
