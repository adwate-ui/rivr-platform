# Glossary

Poker-room and project terms a new developer meets in this codebase. Add a line whenever a new term appears in code.

| Term | Meaning |
|---|---|
| Blinds | Forced bets that set a game's stake; written small/big, e.g. 100/200 |
| Stake | The blinds level of a cash game |
| Buy-in | Money a player converts into chips to sit at a table |
| Cash-out | Chips converted back to money when a player leaves |
| Pot | All chips bet in one hand |
| Rake | The house's fee: 5% of the pot, capped per table type, rounded down to ₹50 |
| Cap | Maximum rake on one hand |
| Drop box | Box under the table where the dealer puts rake and jackpot chips |
| Down | One dealer's shift at one table |
| Pull | Total chips the dealer takes from a pot: rake plus jackpot drop |
| Bad-beat jackpot | Pool funded by a fixed drop per qualifying hand, paid when a very strong hand loses |
| Jackpot drop | The fixed amount taken from a qualifying pot for the jackpot pool |
| High hand | A promotion paying for the strongest hand in a period |
| Call time | Minimum time a player must play after being seated before leaving |
| Waitlist | Queue of players for a game and stake |
| Black card | High-roller tier; priority on the waitlist at its qualifying stake only |
| Marker | Credit extended to a player, settled before any cash-out |
| Cage | The cashier desk that handles all money |
| UTR | Bank reference number of a UPI or bank transfer |
| TDS | Tax deducted at source on winnings; an on/off engine here |
| Freezeout / re-entry / rebuy / add-on | Tournament formats: one entry; enter again after busting; buy more chips; one extra chip purchase at a set point |
| Bounty | Prize for eliminating a player in a tournament |
| Satellite | Tournament whose prizes are seats in another tournament |
| Overlay | Shortfall the house pays when entries do not cover a guaranteed prize pool |
| ICM / chip-chop | Methods of splitting a tournament prize pool by deal before it ends |
| Practice venue | A venue with dummy money used for staff training; never reaches external systems |
| Outbox | Table of business events that background workers send to WhatsApp, social and other systems |
| Kill switch | Controls that freeze the venue, features, messaging, a member or a staff device |
| Effective-dated config | Configuration rows with `effective_from`; a transaction uses the row in force at its time |
| Golden test | Test against a fixture file of known inputs and outputs, readable by a non-engineer |
