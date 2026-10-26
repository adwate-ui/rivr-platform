# 0165: Feedback is asked in the player app, and low scores are tickets for the General Manager

Date: 2026-10-26 · Task: #160, owner request (26 Oct)

Tech plan item 26 asks for a WhatsApp survey when a visit closes. The owner asked for a feedback form in the player app instead.

**On Home.** Home asks about the member's last visit once it has closed: "How was Saturday?". The member gives a score of 1 to 5, with a note if they like. A visit can be rated once, in the week after it.

**In Profile.** The member can send the club a note at any time.

**Tickets.** A score of 3 or below, and every note sent from Profile, is a ticket. Tickets appear on the console's Feedback screen for `feedback.manage` (super_admin and admin, as no General Manager role exists). They stay open until one of them resolves the ticket with what was done. The list keeps 90 days and every open ticket.

**Who can use it.** Feedback is a core feature (`core.feedback`): every member may give it, whatever their tier. The Google review request after the third visit (#159) never reads it, so there is no review gating.

**Not yet.** The WhatsApp survey can follow once WhatsApp templates are live; it would write to the same table.
