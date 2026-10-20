# 0144: Buy-in promotions are weighed at the cage's buy-in, and the seed's Tuesday is every day

Date: 2026-10-20 · Task: #88

**At the buy-in.** Every buy-in at the cage is weighed once by `evaluate_promotions` with trigger
`buy_in`. A trigger on `cage_transaction` does this, with the transaction's amount, how it was paid,
the table it was issued to, and the key `buy_in:` plus the transaction. Any way chips are issued
therefore counts: at the cage, approving a table's request, or a later redefinition of `cage_buy_in`.
A retried tap is one transaction, so it gets one bonus. A buy-in paid from bonus earns none (question
#392). With promotions switched off, or the venue or member frozen, the buy-in goes on and nothing is given.

**The seed.** `57_promotions.sql` publishes the design prompt's live promotions from their templates in both
venues: Buy-in bonus Tuesday, high hands and referral. The seed's clock is the design prompt's Tuesday
whatever the date (decision 0120), so there the Tuesday bonus has no day condition and runs every
day. That way flow 3 and its test hold on any date. The template and every venue's own copy keep
Tuesday. The tests that need their own promotions only, or the templates as a venue starts with them,
return the seed's three to drafts first. The wallet statement test now lists the Tuesday bonus on
its buy-in.
