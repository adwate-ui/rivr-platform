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
| Paise | One hundredth of a rupee. Every amount in code and the database is an integer number of paise (`bigint`) |
| Basis points | Hundredths of a percent: 5% is 500 basis points. Shares of money are computed in basis points and rounded down |
| Chip | The smallest chip is ₹50 (5000 paise); every pot, buy-in, cash-out and rake is a multiple of it |
| Straddle | A voluntary extra blind; the Private Room plays with a compulsory ₹500 straddle |
| Idempotency key | A unique key sent with a write so a retried tap or replayed offline write lands once |
| Ledger line | One account and a signed amount (debit positive) inside a ledger transaction; a transaction's lines sum to zero |
| Reversal | A transaction that is the exact opposite of an earlier one; the only way to correct the ledger |
| Natural balance | An account's balance shown on its normal side, so a member's cash or a jackpot pool reads as a positive amount |
| Feature key | The name of a member-facing feature, such as `learn.library`, checked by `has_feature` and `useFeature` |
| Tier | A membership level (Member, Academy graduate, Founders' Circle, Black card); decides which features a member has |
| Feature override | A super admin's grant or revoke of one feature for one member, with a reason and an optional end date |
| Display mode | How a feature a member lacks appears: hidden (no entry point) or locked (shown with the tiers that have it) |
| Consumer | An outbox worker for one external system (WhatsApp, Tally...); claims deliveries and marks them done |
| Download-and-post | The fallback for a social channel without API credentials: the console offers the image and caption to post by hand |
| Fail closed | Refusing instead of pretending: KYC and payouts answer `not_configured` for a real venue whose vendor keys have not arrived |
| KOT | Kitchen order ticket, printed at the bar for a table-side food or drink order |
| VPA | A UPI address, such as `name@bank` |
| DigiLocker | The government document wallet KYC pulls masked Aadhaar and PAN from |
| Liveness, face match | Selfie checks at KYC: that a live person is present, and that they match the ID photo |
| Mutation score | The share of deliberately broken copies of the code that the tests catch; money modules need 80% |
| Port block | The first three digits of a worktree's local ports (543 root, 544 to 547 lanes A to D, 548 review) |
| Lane | One of four parallel streams of work, each in its own worktree: A money, B floor, C member and web, D growth and content. Lane 0 is the shared foundation built first |
| Super admin | The owner-level staff role (`super_admin`): all data, purge, full exports, the kill switch, per-member overrides and venue configuration. No other role can be given these |
| Admin | The floor manager's role: games, the waitlist, call times, promotions, tournaments |
| Owner view | A read-only role for investors: reports and dashboards |
| Gateable / core feature | A gateable feature can be switched on or off per tier; a core feature (a member's own balance, sign-in) is never gated |
| RVFRZ, RVKIL, RVMBR | The error codes the database raises when a write is refused by the kill switch: venue frozen, feature switched off, member frozen |
| Access revoke | The kill-switch level that ends one staff member's or device's access at once |
| KYC | Know your customer: checking a member's identity (DigiLocker, liveness, face match, PAN) before they can transact |
| PAN | The Indian tax identity number, checked at KYC and used for TDS |
| GST, GSTIN | Goods and services tax, and the club's GST registration number printed on invoices |
| AML | Anti-money-laundering; the console keeps an AML register of money movements to review |
| SOP | Standard operating procedure: a written routine staff acknowledge, kept in the console |
| Host queue | The console's list of members a host should contact, with the churn reason and the offer to make |
| Academy | RIVR's poker course, booked individually or by a company; graduates move to the Academy graduate tier |
| Founders' Circle | A seeded tier with waitlist priority: after Black card, ahead of everyone else, who wait in join order |
| League | A points leaderboard members compete on, shown under Rewards and on the TVs |
| Learn | The player app's study section: drills and licensed books |
| Learn source | One licensed book or course in Learn, switched on per source; its licence expiry switches it off |
| Drill | A practice question in Learn, built from an encoded hand by the drill engine (`@rivr/drills`) |
| Encoding | The structured form of a book's hands and quizzes the drill engine reads; book encodings never enter this public repository |
| RLS | Row-level security: Postgres policies that decide which rows each signed-in person can read or write |
| Policy | One row-level security rule on a table, such as "members see their own entries" |
| Security definer | A database function that runs with its owner's rights instead of the caller's; used for checks that must see every row, kept in the `private` schema |
| Realtime | Supabase's change feed; the apps listen to it so a tier or kill-switch change shows without a reload |
| Account code | The dotted name of a ledger account, such as `member.cash` or `venue.rake`; the chart of accounts is in `docs/contracts/README.md` |
| Parked write | An offline write the server refused for good, kept on the tablet for a supervisor instead of being retried |
| Login link | The tie between a sign-in (a verified phone) and a staff or member record, made only by `link_my_login()` |
