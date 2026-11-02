# 0322: Profile without limits, a break or waitlist alerts

Date: 3 Nov 2026. The player redesign's Profile (brief 3.9) is Account, Notifications and Club. Its "Removals" take three sections out of the app: limits and self-exclusion, Take a break, and the games and stake for waitlist alerts. The owner chose to remove them from the screen only.

- **What goes.** The Profile sections `GamesSection`, `LimitsSection` and `BreakSection`, with their copy. The membership card and identity rows move into Account; Name on club TVs and Analytics move into Notifications; House rules, Send feedback (a sheet now) and the erasure line move into Club.
- **What stays.** The tables and functions behind them (`member_preference` games and stake, `member_limit`, `self_exclusion`, `take_break`, `set_session_reminder`, and `useRestrictions` in `@rivr/db`) and every server check that enforces them (`private.member_restrictions`): a member on a break is still refused a seat, a place on a list, a buy-in and a tournament entry. Staff still put a member on a break from the member's record in the console (`set_member_break`).
- **A break still shows.** On a break, Tonight's banner says until when and a table's sheet offers no join (decision 0300), as Home did; the member's place is gone, as the server removes it.
- **Feedback.** Send feedback is a sheet with the prototype's quick note first and the detailed form (#637) a tab away: the detailed form is not one of the removals.
- **Learn and Events.** They lost their tabs in the redesign. Until the owner says where they live, each is a row under Club, behind its feature as before (`learn.library`, `events.book`).
- **Open.** Whether a member should set limits or a break from the app again is the owner's question, and so is the session reminder a member set before, which still pushes and which they can no longer change (#784). Removing the backend is not part of this work.
