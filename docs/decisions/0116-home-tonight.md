# 0116: Home's tonight: open seats, the jackpot, the next tournament, and Join after KYC

Date: 2026-10-21 · Task: #87

**Open seats.** Each table on Home shows its open seats: its seats less those sat in or held for a member the floor has called, each seat once (the floor may seat a called member in their held seat before their place closes). A held seat is not open to anyone else. `floor_open_seats()` reads them on the same terms as the waitlist lengths: a member of the venue with the live floor, or its staff. It reads lane B's seats and waitlist, so it is in lane B's contract; the owner agreed on 21 Oct, the lane builders having finished. The jackpot reads through lane B's `main_pool()`.

**Gating.** Rule 8 needs a feature key for each of these. None of the catalogue's keys names the jackpot or the next tournament, and a new key would need a tier decision for every tier.
- The bad-beat jackpot is part of tonight's floor, and the TVs already show it, so it goes with `floor.live_view`.
- The next tournament goes with `tournaments.register`, whose screen is already `player:home/tournament`.

`my_tonight()` leaves each out without its key, and Home gates them too: the jackpot shows only with the live floor, whose own notice says when it is locked, and the tournament's `FeatureGate` shows its locked notice. Neither is secret (the jackpot is public through `public_jackpot` and the TVs, and members read published tournaments), so the keys shape Home rather than guard data.

**KYC.** `my_tonight()` also says whether the member's identity check is done (`private.is_kyc_complete`, the check every money step uses). Until it is, Home shows "KYC incomplete. Finish it to join a table." with Finish identity check, and no Join. Joining is still refused in the database (`RVKYC`).

**One venue.** A member reads only their own venue's. A practice member sees the practice venue's tournament and jackpot.
