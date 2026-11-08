# 0562: Stakes carry the game

Date: 9 Nov 2026 · Audit of 8 Nov (F-122)

**Why.** The console wrote a stake three ways, and a Private Room's name stood in for its stake, dropping the 500 straddle.

**What.** A table's stake is the game and its blinds and any straddle, `NLH 100/200/500`, through `formatGameStakes`, on the Live floor, the Waitlist and their sheets.

**Open.** `.claude/rules/copy.md` still says "Stakes as blinds, 100/200". A question issue asks whether to change it. A member record's "Qualifies at 100/200" keeps the blinds alone, as `member_record` has no game.
