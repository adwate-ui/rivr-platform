# 0063: Dual control is a second approver on their own session, from the threshold up

Date: 2026-10-20 · Task: #20 · Question: #360

Scope-v1 module 5 asks for a second cashier or the floor manager above a configurable limit; the
money rules ask for it to be enforced in the database. The prototype's cashier picks an approver by
name, which the database cannot check.

So the second approver approves from their own signed-in session: a staff member holding
`cage.second_approve` at the venue records a `second_approval` for the write's subject and amount (each
approver once), and the write is refused with `RVAPP` until someone other than its first approver (the
staff member who decides the write, which the write must name) has approved that subject and amount
and is still active, with access not revoked. This is the kill switch's two-step pattern (#27), and
needs no new PINs.

The threshold is the setting `cage.second_approver_threshold`, effective-dated, and counts from the
threshold up: flow 9 withdraws exactly ₹1,00,000 and needs a second approver, as the prototype's
`amount >= 1,00,000` does. With no threshold set, every amount needs one: failing closed.

Withdrawals (#21) are the first write to use it, as in the prototype; flow 8 pays a ₹1,20,000 cash-out
with no second approver. #360 asks the owner whether cash-outs and markers need it too. A longer lead
time before a lower threshold takes effect belongs to #323.
