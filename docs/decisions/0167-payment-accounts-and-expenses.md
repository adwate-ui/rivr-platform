# 0167: Payment accounts are ledger accounts, and an expense posts only on a second person's approval

Date: 2026-10-26 · Task: #94, #95 (additions "Expenses and payment accounts")

**Accounts.** Each payment account is a ledger account. The cash drawer and "Bank and UPI" that every venue starts with are its first two. Treasury managers add UPI handles and bank accounts, each with a ledger account of its own (code `venue.payment.<letters>`). The details shown are a handle, or the bank and last four digits, never a full account number.

**Balances.** A balance is what the ledger has moved through the account. The drawer's float is counted at each cage shift (#24, #45), not posted, so the drawer's balance is the net of the night's movements. For that reason no transfer or expense is refused for the balance. The end-of-day count catches a drawer that is short.

**Who.** A new permission, `treasury.manage`, is held by super_admin and admin. It adds accounts and categories, moves money between accounts, and decides expenses. Where a venue keeps money work to its computers (#384), `treasury.manage` is held to the admin computer, as the other console money powers are. The cage (`cage.transact`) and treasury managers ask for expenses. Ledger readers see the accounts and their statements.

**Expenses.** An expense posts from its payment account to its category's expense account only when a treasury manager who did not ask for it approves. A refusal needs a reason and posts nothing. A drawer or bank line needs an open cage shift (decision 0107), so the end-of-day close counts it: an expense or a transfer out of the drawer lowers the cash expected. Money moved into the bank from another of the club's accounts is not a player's receipt, so the close's receipts leave transfers out. A retried tap gives the same transfer or expense; the same key with other figures is refused.

**Receipts.** Receipts are photos (JPEG, PNG or WebP, up to 5 MB) in the private `expense-receipts` bucket, at `<venue>/<expense>.<ext>`. The venue's cage and treasury managers read them. One is uploaded only at an expense's own path and only before that expense is asked for. An expense names a receipt only if the person asking uploaded it. Nobody changes or deletes one.

**Remaining risk.** An admin can create a second admin login (`staff.manage`) and decide their own expense with it. Creating the login is audited; the owner reviews new admin logins.

**Not here.** The Tally voucher export is #96.
