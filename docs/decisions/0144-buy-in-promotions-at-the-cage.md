# 0144: Buy-in promotions are weighed at the cage's buy-in, and the seed runs the deck's three

Date: 2026-10-20 · Task: #88

A trigger on `cage_transaction` weighs every buy-in once with `evaluate_promotions` (trigger `buy_in`,
key `buy_in:` and the transaction, with its amount, method and table). So chips issued at the cage
or on approving a table's request (flow 3) both count, and a retried tap is one bonus. A buy-in paid
from bonus earns none (#392); promotions off or a freeze: the buy-in goes on, nothing is given.

`57_promotions.sql` publishes Buy-in bonus Tuesday, high hands and referral from their templates in
both venues, as they stand, skipping a frozen venue or one with promotions off. Tuesday is the club
day (decision 0140). The pgTAP test and the e2e flow make today the rule's day (the flow puts Tuesday
back); tests needing only their own promotions return the seed's to drafts first.

Open in question #433: the calendar or the club Tuesday, and whether a bonus-paid buy-in takes one of
the five places. Until answered: the club day, and places counted by bonuses given.
