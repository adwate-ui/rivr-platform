# 0206: Tournament bounties and progressive bounties

Date: 2026-10-26 · Task: #117

A template, and the tournaments made from it, may put part of each entry's buy-in on the player's head: a bounty in ₹50 chips, below the buy-in less the fee. Like the add-on, it is an option of a format, not a format.

- **Not in a rebuy.** A busted player's rebuy comes back on the same run, whose bounty was already paid, so a rebuy tournament has no bounty.
- **On a bust** the floor names who knocked the player out, a seated player at the same table (the database checks it), and that player is paid at once: a standard bounty whole, a progressive one half, rounded down to ₹50 chips, the rest added to the eliminator's own head (`bountyOnBust`, twin `private.tournament_bounty_split`, golden `tournamentPayouts.json`). A re-entry is a new run with a new bounty.
- **At the finish** each player left is paid the bounty on their own head with their prize, as one payment.
- **Money.** The bounty stays in `venue.tournament_pool` (players' money) until paid, and is left out of the prize pool the field shows. A bounty paid on a bust is taxed on its own, and a finisher's own bounty with their prize as one payment (decision 0205), and kept on `tournament_payout` with what went on the head.
- **Seed.** Bounty Thursday: ₹5,000 with a ₹500 fee and a ₹1,000 standard bounty, re-entry to level 4, top 3 paid.
