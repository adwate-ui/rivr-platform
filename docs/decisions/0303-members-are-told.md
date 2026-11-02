# 0303: Members are told

Date: 3 Nov 2026. The second of the workflow PRs from the workflow audit of 2 Nov, as the owner settled it on 3 Nov: two pushes only (seat ready and call time ending, built with the player redesign), and WhatsApp for what happens while the member is away from the app.

- **One event, member.notice.** It names the member, the notice and its words; the WhatsApp consumer sends it in the notice's own utility template, so no opt-in is asked. Triggers raise it, so every path that writes the row is covered.
- **Identity check.** At most once an hour for each outcome of a check. Verified ("You are verified at RIVR Poker Club"), waiting for review ("RIVR is checking your details"), or refused, with its code put in words ("you must be 18 or over to play", "these details are on another membership", "the front desk could not confirm your details") and the way back: bring Aadhaar and PAN to the front desk. Never a reviewer's note, which is a staff note.
- **Rewards.** A cancelled redemption: the member hears which, that what they paid is back, and to see why in the app (decision 0302). Staff's words never go into a message from the club's number: a link or another person's name typed there would read as the club's. Every word a notice carries is one line of plain text, with no link and none of WhatsApp's formatting marks, or it is refused. A redemption itself is the member's own act in the app, so it sends nothing.
- **The leaving list.** A seat on the leaving list that ends, by whichever path, tells the member it is released.
- **Not sent late.** A notice claimed over six hours after it happened, or of no known time, is not sent: the member has seen it in the app. So switching WhatsApp on never sends a backlog.
- **Not here.** Join requests approved or removed, seated, top-up done and order progress are in the app as they happen (the redesign's toasts, tracker and status rows); a break set by staff is told at the desk.
