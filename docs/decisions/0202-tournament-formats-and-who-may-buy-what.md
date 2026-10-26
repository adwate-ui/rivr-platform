# 0202: Tournament formats, and who may buy what and when

Date: 2026-10-26 · Task: #116

Three formats: **freezeout**, **re-entry** and **rebuy**. An **add-on** is an option of any format, not a format of its own. `@rivr/domain` `checkPurchase` and `private.tournament_purchase_refusal` give the same answer on `tournamentEntry.json`. Registration (#118) will refuse with them.

- **Registration** is open before the clock starts and to the end of the last registration level, the break after it included (a break counts as the level before it). RIVR Sunday's is level 9; 0 closes it at the start.
- **Entry**: one first entry per player, while registration is open.
- **Re-entry** (re-entry format only): a new entry for a player who has busted, while registration is open.
- **Rebuy** (rebuy format only): more chips for a player alive or busted, while registration is open. That period is the rebuy period. Who is at or below the starting stack is the floor's call: the system does not track stacks.
- **Most buys**: the first entry and every re-entry or rebuy count toward it; none set is no limit. A freezeout has one, so its column stays empty.
- **Add-on**: one per player with chips, during the last registration level or the break after it.
- Checks run in a fixed order, and the first that fails is the answer: format, entered, still playing, registration, limit.
- **Prices.** Every buy costs the buy-in, its fee inside it. The add-on has its own price, fee and chips.
