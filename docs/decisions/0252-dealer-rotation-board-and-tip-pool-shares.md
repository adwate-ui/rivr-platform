# 0252: The dealer rotation board, and tip-pool shares by time dealt

Date: 2026-10-28 · Task: #124

- **The board.** For staff who run the floor (`floor.manage`), on the console's Dealers screen. Each dealer dealing now, with their table, since when and for how long, due for rotation once past `dealer.rotation_minutes` (a venue setting, 10 to 120; 30 when not set). Below them, each active dealer resting: one who dealt in the last twelve hours or is on a rostered shift now, since their last down ended or their shift began. Dealing first, the due first; resting, the longest rested first. The board reads again each minute.
- **Twelve hours, not the club day.** "Resting" uses the last twelve hours rather than the club day from 06:00, so a dealer who stopped at 05:50 does not vanish at 06:00, and the board reads the same at any hour.
- **Each dealer over a period** (the club's days chosen): downs, the time of them inside the period (an open down runs to now), hands dealt, hands per hour to one place, rake logged, and the drop-box variance of the downs counted (count less logged, decision for #44). Hands per hour and rake variance per dealer are the scope's "S10.2".
- **Tip pool.** Tips belong to dealers and RIVR holds none, so nothing records them. The export gives each dealer's share of the pool by time dealt (`hourShares`, basis points adding up to 100%); the floor divides the cash by it. Splitting by hands or by attendance would be a change to `hourShares` alone.
- **Not built.** Suggesting who takes which table next, and tips recorded in the system.
