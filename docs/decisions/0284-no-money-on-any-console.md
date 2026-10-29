# 0284: No rupee or rake on any console

Date: 29 Oct 2026. Owner's feedback doc of 29 Oct ("RIVR App | Detailed Feedback"), phase E of the Fix Tracker, issues #626 to #647. Its core rule: "No mention of rupee, rake anywhere on any console. No financial settlement, MIS, reporting, tracking required anywhere."

- **Hide; don't delete.** The ledger, cage, rake, tax and tournament code and their database tests stay. The screens go. A hidden console screen is marked `hidden` in the rail: it is off the rail, and its address is refused to everyone. Its code stays for when the club wants it back.
- **Hidden in the console** (the owner's list, plus what still showed money):
  - the owner dashboard, Tournaments, Dealers, Jackpots and High hands;
  - all of Cage, Money and Reports;
  - Players' Tiers;
  - Marketing's League, Events, Creators and Academy;
  - Team's Roster, Certification, SOPs and Incidents;
  - Exports;
  - Settings' rake, cage, tax, compliance, academy, system and chips areas, and the rules that turn rake or money into points or bonus;
  - Devices' computers and cameras;
  - the live floor's rake and rupee figures, F&B's Glaza statement and Social's winner cards.
- **Hidden in the player app** (#627): the Balance tab with deposits and withdrawals, the Academy's batches and payments, winner cards, Home's jackpot, and every buy-in, prize, pool and ticket value. Sessions show when, the tables and how long, and a member can hide one from their own list; the club keeps it. Bonus amounts read as chips (`formatChips`). The hidden addresses go to Tonight or Learn.
- **Hidden on the TV** (#628): the jackpot mode (`HIDDEN_TV_MODES`: the console does not offer it, and a TV still set to it shows the waitlist board), the tournament clock's prize pool and the spin wheel's rupee prizes, which read as bonus chips.
- **Points by hand only** (#629): no points for hours played or a share of rake, and no weekly rakeback. A migration sets every points rate in force to zero, the seed gives none, and the rakeback job is unscheduled; the rules' code stays. The website leaves out a zero points rate and still shows rakeback, at the owner's word. Every bonus a console shows reads as bonus chips (`formatChips`).
- **The tablet is optional** (#630): it keeps the seats, call time, away and back, leaving and food, all of which the console does too (it gained Away and Back). Hand entry, buy-in requests and the drop-box count are off it; a down ends with nothing counted.
- **Also off the console:** the high-hand claim prompt across the top of every screen (it asked to approve a payout in rupees). Devices keeps its Tablets tab, as the tablet stays (#630).
- **Promotion words:** the promotions a venue starts with say bonus chips, not rupees, and RIVR Rewards no longer promises points from rake.
- **Left to later batches:** top-ups come with #634 and #639, and Learn's own points (`learn.session_points`) stop when #637 switches Learn off.
- **Learn, the Academy and Events off** (#637): by their feature keys, `learn.library`, `academy.booking` and `events.book`, for every tier from now, hidden rather than shown locked, and off for a new venue's tiers. They come back as any tier feature does. The rest of Learn's features keep their cells. The website's Academy page still links to the app, where the address goes to Learn: the owner decides it with the website.
- **Tournaments by interest** (#636): Home lists the club's upcoming published tournaments, with no buy-in, and a member registers interest; they pay at the venue, and the floor marks them registered on the console's Tournament interest screen (waitlist.manage). The tournament card, its buy-ins from the balance and the satellite tickets are off Home.
- **Staff stays** for staff managers. Staff accounts, their roles and the dealers' PINs have no other home.
- **The website keeps** its rupee buy-ins, jackpot and rakeback, at the owner's word. The tablet stays, but every workflow runs without it.
- **e2e:** flows whose only purpose was a hidden screen are removed; their database sides stay in pgTAP. Flows that only passed through one, such as call time through the cage, now run the console's own path. With the practice cage's flows gone, CI's fourth e2e runner for `@practice-cage` (decision 0243) is gone too: the three shards run every flow.
