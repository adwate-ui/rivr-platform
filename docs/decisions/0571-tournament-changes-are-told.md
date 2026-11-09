# 0571. Members hear when a tournament is withdrawn or moved

Date: 9 Nov 2026. The owner's answer on #877.

When a tournament is withdrawn, or its day or time changes, those who asked about it and those marked registered are told, by WhatsApp and push. A correction that keeps the day and time, to the minute, tells nobody. Publishing a withdrawn tournament again tells nobody: the answer did not ask for it.

A trigger on the tournament raises one `member.notice` for each member, as other things a member hears of away from the app do (decision 0303), so every path that writes the row is covered. The push consumer reads that event for these two notices and leaves the rest to WhatsApp. They stay worth sending for two days, not six hours: a withdrawn tournament leaves the member's list, so the app does not say so.

**Who is told.** A push goes under the member's Tournament notifications setting; WhatsApp is a utility message. A member on a break hears only that a place they paid for will not run. Anyone who has not paid follows their tier's `tournaments.register`. Those last two narrow the answer's words, the safest reading until the owner says otherwise.

**The name.** Decision 0303 keeps staff's words out of messages from the club's number; a tournament's name is the exception, as a reward's is. It goes out as plain words only: no link, WhatsApp mark or long number. A move that also renames says the old name, the one they asked about.

**A limit.** Three changes told in an hour for one tournament is the most. The next is refused, and says so, so saving again and again cannot flood members or hold up seat calls in the same queue, and a real change is never dropped unseen.
