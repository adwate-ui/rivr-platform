# 0709 Cashiers see all of Members and handle Bonus

Date: 22 Nov 2026. The owner's request, 22 Nov ("Allow cashiers to have full members view-only + only bonus related updates - add, redeem, reverse"), and their two answers.

- **Members, to view.** Cashiers hold `members.phone`, as the floor does (0708): Members in the rail, the mobile column a page at a time, the record's number, the selfie, Tier and break and Account read-only, the member's History, and names that open the record from the floor and its requests.
- **Bonus.** Cashiers hold `bonus.give`: Bonus by hand within the by-hand caps the floor has, Bonus used without a seat on Members and at the Door, and, as `bonus.give` has always meant, a high hand logged (which pays Bonus).
- **Redeem and reverse.** A permission of its own, `bonus.correct`, for super admins and cashiers, replaces the super-admin check on reversing any Bonus given (`reverse_bonus`, the same rules as before) and adding a use a seat missed (`add_bonus_use`, with the seats it reads).
- **Stays with super admins.** Bonus from a file, approving a promotion's Bonus, a member's phone changed, feature overrides, erasure and ID documents.
- **Tests.** pgTAP 601 proves a cashier's reads and each Bonus action, and what stays refused; the tests that held cashiers out moved to a host or a dealer.
