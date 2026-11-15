# 0605 A stake's straddle beside its typed name

Date: 15 Nov 2026. Issue 990 (follows RD-17, PR 988). The owner's rule: a stake with a straddle is written with it, "NLH 100/200/500", wherever a stake or a table's stake is named.

- Six reads named a stake without its straddle and now return it (migration `20261118100100`): the member's place on a list (`my_waitlist`), seat (`my_seat`) and past sessions (`my_sessions`), the TV's waitlist and call time boards, and the dealer tablet's seats. Those that show the stake's typed name also return its game; the call time board, which had the name alone, its blinds too. The new columns come last.
- The Tables report names tables, not stakes, so it is unchanged.
- Where a screen writes figures (past sessions, the tablet's felt), the straddle follows the blinds: "100/200/500".
- Where a screen shows the name the admin typed (seat ready, waiting, seated, both TV boards), the issue left open whether the figures replace the name, follow it, or are added where there is room. Taken, as the reading that loses nothing: the name stands. With no straddle it reads as today. With a straddle the figures are written with it: in place of a name that is only the stake's own figures ("NLH 100/200" becomes "NLH 100/200/500"), and after any other name ("Private Room · NLH 100/200/500"). One formatter, `formatStakeName` in `@rivr/i18n`, does it. A question issue asks the owner to confirm.
- The migration is written from the database's own definitions by a script, so each function is exactly as the newest migration left it, plus the columns. `my_sessions` reads the cage's and the markers' tables; when those are dropped (RD-10) the function is written again from whichever body is then current.
