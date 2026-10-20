# Running the room on paper

When the system cannot be used, the room runs on paper and the paper goes back into the system afterwards, with nothing lost. There are five runbooks. Staff read and acknowledge them on the console, under SOPs, as "Fallback: app down" and the rest (#52). This page has the same steps, the paper forms to print, and the drill.

Print a stack of each form and keep it at the cage, with pens and the contact list (the escalation directory, #53, once it is on the console). A venue freeze (the kill switch) is run the same way: while the venue is frozen, the room is on paper.

## The runbooks

| Runbook | When | Paper | Back in the system |
|---|---|---|---|
| **App down** | The console cannot be reached, or the venue is frozen | Cage paper log (buy-ins only; no cash-outs on paper), floor sheet | The floor seats each player from the floor sheet. Then the cage enters every slip in number order and ticks it. The duty manager checks nothing is lost. |
| **Wi-Fi down** | The tablets lose the network | Hand sheet, only for a tablet that has died. The others keep logging, and hands wait on them, through a restart too | The waiting hands send by themselves; check each tablet shows none waiting. A hand sheet's pots are set against the drop-box variance. |
| **Power cut** | The lights go | Outage sheet, then as for app down if the cage computer goes off | As for app down. Count the cage and the chip trays before play restarts. |
| **UPI down** | UPI payments fail | UPI sheet. Cash only; give no chips for a UPI payment yet | The member records the deposit in the app with its UTR, and the cage confirms it against the bank by amount and UTR. A line not yet in the app stays unticked. |
| **KYC vendor down** | Identity checks cannot finish online | Identity sheet, if the console is down too. No chips without a complete check | Finish each check in person on the console, and tick it. |

The hand sheet is only for a tablet that has died: the dealer writes each pot on it. When that down ends, its pots are set against the drop-box variance.

In every runbook the duty manager calls the fallback, writes the start and end on the outage sheet, and signs the sheets. The signed sheets are kept with the night's end of day.

## The paper forms

**Outage sheet.** One per outage.

| Started | Runbook | Called by | Ended | Slips used (first to last) | Chips in play before and after | Checked by |
|---|---|---|---|---|---|---|
| | | | | | | |

**Cage paper log.** Buy-ins only, one numbered slip per line. Use the numbers in order; never skip or reuse one. Cash only. No cash-outs on paper: a player's chips stay with them until the system is back.

| Slip | Time | Member | Mobile number | Table and seat | Amount | Cashier | Entered ✓ |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

**Floor sheet.**

| Time | Member | Mobile number | Table | Seat | Taken or left | Floor | Entered ✓ |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

**Hand sheet.** Only for a tablet that has died; one per table.

| Time | Pot | Game | Dealer |
|---|---|---|---|
| | | | |

**UPI sheet.**

| Time | Member | Mobile number | Amount | UTR | Cashier | Confirmed ✓ |
|---|---|---|---|---|---|---|
| | | | | | | |

**Identity sheet.**

| Time | Name | Mobile number | Documents seen | Staff | Checked ✓ |
|---|---|---|---|---|---|
| | | | | | |

## Bringing the paper back, and checking nothing is lost

1. **The floor first.** Seat each player on the floor sheet (Live floor, a table, a seat, the mobile number). A player who has left since is seated too, so their slips can go in. The system stamps the time each is entered; the sheet keeps the time it happened.
2. **Then the cage.** Enter every slip in number order: find the member, then the amount and Cash. Tick the slip as the console confirms it ("₹5,000 of chips issued.").
3. **Then the check.** The duty manager confirms three things:
   - every slip is ticked;
   - the slip numbers run from the first to the last without a gap;
   - the slips add up to the cash taken on paper.

   A slip that will not go in, say because the member is frozen, stays unticked. It is settled before anyone signs, so it is not lost. A slip left out by mistake shows at the end of day as cash over.
4. **Call time.** A player seated on paper has their call time counted from when they are entered. Their call time from the floor sheet's time may already be done. An admin then lets them leave early, with the reason "Paper fallback, seated at" and that time (question #402 asks for a better way).

## The drill: 30 minutes on paper

Run it in the practice venue during a mock session, so nothing touches the club's records. In the console, turn on Practice venue at the foot of the rail.

1. A super admin freezes the practice venue with the kill switch (reason: "Paper fallback drill"). The console and the tablets show the freeze.
2. For 30 minutes the room runs on paper as in **App down**: the floor sheet and the cage paper log, while the tablets keep logging hands.
3. A super admin asks to release the freeze, and a second releases it.
4. Bring the paper back and check it, as above.

The drill passes when every slip is ticked, without a gap, and the slips add up to the cash. With no hands logged while the slips go in, Treasury's "Chips in play" also rises by exactly the log's total. Write it on the outage sheet before and after. The end-to-end flow "Paper fallback" plays a short version of this drill on every change (`e2e/flows/paper-fallback.spec.ts`).
