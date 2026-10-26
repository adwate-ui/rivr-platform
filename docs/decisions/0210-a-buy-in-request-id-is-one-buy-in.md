# 0210 A buy-in's request id is that one buy-in

Date: 27 Oct 2026. Task: #335 (follow-ups from the #57 review).

- **A replay must match in full.** `cage_buy_in` gives the first buy-in back only when a replay names the same member, amount, method, UTR and table request. Anything else is `22023`. Before, a replay with another UTR, or approving another request, was reported as the first, and the other request stayed waiting while the cashier believed it paid.
- **Of its own kind.** Cash-outs and marker repayments share the cage's request ids. A buy-in replaying one of their ids is `22023` too, never a cash-out reported as chips issued.
- **The form makes a new id when the UTR or amount changes after the cage refused the last try.** A refused try wrote nothing, and another UTR is another bank transfer, so it is another buy-in. The same UTR and amount again keep the id, and so does a double tap.
- **Except once a try may have gone through**: still waiting, no answer, a changed replay refused (22023, which in this form means the id holds a buy-in), or a refusal before the cage looks (42501). The id then stays, whatever is edited and whatever the cage refuses next, until a try succeeds, so the cage gives that buy-in back or refuses the change. Renewing it there would issue chips twice, for example a wallet buy-in whose answer was lost followed by the same chips paid by UPI. The money auditor raised this. The safest reading is taken, and question #481 asks the owner to confirm it.
- **One UTR, one payment, was already true.** `private.refuse_used_utr` (#29) checks every table that holds a UTR: buy-ins, marker repayments, Academy payments and turn-downs, withdrawals and deposits. #335 adds tests for buy-ins against Academy payments and changes nothing else there.
- **Balances.** The cage's wallet (`private.wallet_cash`), bonus and markers now come from `private.account_balance`, the ledger's one balance function. The amounts are the same.
