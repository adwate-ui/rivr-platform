# 0144: Buy-in promotions are weighed at the cage's buy-in, and the seed runs the deck's three

Date: 2026-10-20 · Task: #88

**At the buy-in.** Every buy-in at the cage is weighed once by `evaluate_promotions` with trigger
`buy_in`. A trigger on `cage_transaction` does this, with the transaction's amount, how it was paid,
the table it was issued to, and the key `buy_in:` plus the transaction. So chips issued at the cage
count, as do chips from approving a table's request (flow 3), and so would any later redefinition of
`cage_buy_in`. A retried tap is one transaction, so it gets one bonus. A buy-in paid from bonus earns
none (question #392). With promotions switched off, or the venue or member frozen, the buy-in goes
on and nothing is given.

**The seed.** `57_promotions.sql` publishes the design prompt's live promotions from their templates in both
venues, as they stand: Buy-in bonus Tuesday, high hands and referral. A venue that is frozen, or has
promotions off, is skipped. Tuesday is the club day, 06:00 to 06:00 IST, as the engine reads every
day (decision 0140).

**The tests.** The pgTAP test and the e2e flow make today the Tuesday rule's day, so flow 3 holds on
any date; the flow puts Tuesday back when it ends. Tests that need only their own promotions, or the
templates as a venue starts with them, first return the seed's three to drafts.

Two money questions stay open in question #433:
- whether the design prompt's Tuesday 00:10 is Tuesday's night or Monday's club day;
- whether a buy-in paid from bonus takes one of the first five places.

Until they are answered, the code keeps the engine's readings: the club day, and places counted by
bonuses given.
