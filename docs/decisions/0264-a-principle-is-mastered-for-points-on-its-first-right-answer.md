# 0264: A principle earns its Learn points on its first right answer

Date: 28 Oct 2026. Issues: #135, #136.

**Context.** Learn pays 25 points for each principle "mastered" (decision 0263). The spec defines mastery as retention (FSRS), which builds over days, while a session must pay what it earned when it ends.

**Decision.**
- For points, a principle counts as mastered the first time the member answers it right in a session of that title.
- The server pays it once per member and title, only for a principle answered in that session, within the day's cap.
- The hub's Mastery figure stays retention across the book (`masteryOf` score), with how many principles have been met beneath it.

**Consequences.** Points come at once and cannot be farmed: each principle pays once, and the daily cap holds. Mastery as retention is what the member reads to see how well they hold the book. If the owner wants points tied to retention instead, the rule changes in `complete_learn_session` and the summary only.
