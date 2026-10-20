# 0107: The cage moves no money without an open shift, and an opening is set against the last close

Date: 2026-10-20 · Task: #376 (the owner's answer to #367)

A trigger on every ledger entry refuses (RVNSH) a request from an app that moves the cage's money while no
shift is open at the venue: any line on the drawer or the bank (cash and UPI buy-ins and cash-outs,
deposits, withdrawals, Academy payments, payouts in cash) and any buy-in, cash-out or marker however it is
paid. One check in the ledger covers every cage function, those to come too. Migrations, the seed and jobs
post with nobody signed in, so they are not stopped; neither are a hand's rake or a member's own request.

Opening a shift sets its float and chips against the venue's last close's counted cash and chips, by the
close's own rule (`private.shift_close`, proved on eod.json). A difference is an anomaly, as at the close:
an alert, and a manager (eod.review) who neither opened this shift nor closed the last gives the reason
on End of day.

The seed opens a shift at both venues, so every flow and a demo that uses a cage works, on staging too
(Academy payments confirms in the practice venue there). Treasury's flow sees the club's instead of
opening one; End of day closes the practice venue's; the Cage shift flow then finds it closed.
