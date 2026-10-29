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
- **Staff stays** for staff managers. Staff accounts, their roles and the dealers' PINs have no other home.
- **The website keeps** its rupee buy-ins, jackpot and rakeback, at the owner's word. The tablet stays, but every workflow runs without it.
- **e2e:** flows whose only purpose was a hidden screen are removed; their database sides stay in pgTAP. Flows that only passed through one, such as call time through the cage, now run the console's own path.
