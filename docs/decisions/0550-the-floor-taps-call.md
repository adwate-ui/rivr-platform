# 0550: The floor taps Call

Date: 9 Nov 2026 · Audit of 8 Nov (F-050, F-166) · The owner, 8 Nov · Builds on decisions 0299, 0302 and 0480

**Why.** Every seating from a list went through a call, so a member already sitting down was told "Your seat is ready". Nothing else placed a call, so the hold and "I'm on my way" never ran. The owner chose to keep calls as a one-tap Call.

**What.** Call, beside Seat on a waiting member, holds the first free seat at the list's table for the club's hold (20 minutes) and tells them by WhatsApp and push. Seating from a list says nothing. A member called is seated through the same sheet as anyone else, at the seat held for them, so a call time and bonus chips can still be given.

**Safest reading of "the floor taps Call".** A call that ends, by its hold running out, a Skip or the member leaving, frees the seat and calls nobody. It used to roll to the next name, which messaged each in turn with no floor tap and could empty a list in two hours. `private.roll_call_on` stays as an empty function so its six callers need no change. Question issue open for the owner.

**Limits.** At most five seat messages an hour to one member, so a loop of calls and skips cannot flood them or hold up the outbox; the seat is still held. Staff cannot call their own member record.

**Not done.** A call released within a minute of being made can still send its message, as the consumers check only the hold's end. Follow-up issue open.
