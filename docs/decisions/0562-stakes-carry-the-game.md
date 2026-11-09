# 0562: Stakes carry the game

Date: 9 Nov 2026 · Audit of 8 Nov (F-122)

**Why.** The console wrote a stake three ways, and a Private Room's name stood in for its stake, dropping the 500 straddle.

**What.** A table's stake is the game and its blinds and any straddle, `NLH 100/200/500`, through `formatGameStakes`, on the Live floor, the Waitlist and their sheets.

**Since.** `.claude/rules/copy.md` follows this, on the owner's word (9 Nov, #875). A player's sessions and the tablet's felt still write blinds alone, as their data carries no game. A member record's "Qualifies at 100/200" keeps the blinds alone, as `member_record` has no game.
