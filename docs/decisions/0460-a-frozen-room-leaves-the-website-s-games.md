# 0460: A frozen room leaves the website's games

**Date:** 2026-11-03 · **Issue:** #613

A later room shares the club's website and has no pages of its own (decision 0036). Since #609, the site pauses only for a freeze on the venue whose pages it serves. The games block (`public_table_status`) still read every real venue's tables, so a frozen room's open tables showed seats.

**Decision.** A room's freeze takes that room's tables off the games block. It does not pause the whole site.
- `public_table_status_rows` leaves out every venue under an unreleased venue freeze, the club's own included. While the club is frozen its site is paused anyway, and its tables cannot take players.
- The rest of the shared site carries on: the club's pages, its promotions and its calendar.

**Why not pause the whole site.** One room's inspection would take the club's website off the air, and the club itself is still open.

**Tested by** pgTAP `295_frozen_room_off_the_games`: a second real room, frozen and then released.
