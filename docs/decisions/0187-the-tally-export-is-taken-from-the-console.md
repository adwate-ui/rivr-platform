# 0187: The Tally export is a file taken from the console, a voucher per kind of transaction

Date: 2026-10-26 · Task: #96

**What.** Tech plan item 16: a daily voucher file in Tally's import format, from a mapping of ledger accounts to Tally ledgers, one file per venue per day. A treasury manager (`treasury.manage`) chooses a club day that has ended (06:00 to 06:00 IST) on the console's Tally screen and saves the file. Each take is recorded in the audit log (`export.tally_day`). The practice venue is refused.

**Not an outbox consumer.** The tech plan lists Tally among the outbox's consumers, but Tally runs on the accountant's computer and imports a file; there is no service to send to. The file is a pure function of the day's ledger, which is append-only, so taking it on demand gives the same file for the same day. If the owner later wants files pushed somewhere, a consumer can call the same function.

**Mapping.** By account code, not by account: a member's own accounts share a code, so all members' cash posts to one Tally ledger, and each expense category has its own code. The chart of accounts is the owner's (tech plan, decisions due 28 Oct), so nothing is mapped by default; a day whose postings touch an unmapped code is refused, naming the codes.

**Vouchers.** One journal voucher per transaction kind per day, its entries summed by Tally ledger (`@rivr/domain` `tallyVouchers`, golden `tally.json`); a hand-by-hand voucher would be thousands a day. Debits are "deemed positive" with negative amounts, as Tally's XML expects. Points never go to Tally.

**In Tally.** Every voucher is a journal, so the company's Journal voucher type must allow cash accounts (Tally refuses them in journals otherwise). Tally creates what it imports, so each day's file is imported once; the screen says so. Both are to confirm with the club's accountant on a first real import.
