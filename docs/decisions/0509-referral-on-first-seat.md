# 0509: A referral completes on the friend's first seat, and sign-up asks for the code

Date: 9 Nov 2026 · The owner's question "where are we asking players for their referral code? How are we giving rewards?" and answer (my recommendation, approved)

**What was wrong.**
- **No code field:** sign-up had no place to type a code. It came only from the invite link (`?ref=`), which the browser keeps for 30 days. A friend who opened the app any other way lost it.
- **No referral ever paid:** a referral completed on the new member's first buy-in (`private.complete_referral` from the buy-in trigger). Since the Cage was hidden (29 Oct, decision 0284) no live screen records a buy-in, so none completed and nobody was paid.

**Now.**
- **First seat:** the new member's first seat session completes the referral, however the floor seats them (by number, from a list, a call). The referral promotion credits each side as before, and a buy-in completes nothing.
- **After Undo:** a sweep each minute pays once that seat is past its two minutes of Undo (decision 0480). A seat taken by mistake and undone pays nobody, and bonus chips redeemed with that seating never meet a reversed credit. While the venue is frozen or promotions are stopped, it waits.
- **Paid once for earlier play:** members who signed up with a code and played before this rule are paid once as the migration runs (the owner, 9 Nov); the deploy's log gives the count.
- **Sign-up field:** sign-up shows an optional "Referral code" field, filled in from the link, to keep, change or clear. A code that names no member of the club is refused: "No member has that code. Check it, or leave it empty." (the owner, 9 Nov).
- **Copy:** "…when a friend joins and takes their first seat".

