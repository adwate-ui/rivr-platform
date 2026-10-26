# 0185: Pot data is the super admin's, read by the club's days

Date: 2026-10-26 · Task: #114

**Who.** The spec says the super admin views and exports every hand by table, dealer, variant and period. A new permission, `pot_data.read`, is held by the super admin only. Hands' rake is already readable to staff who read the ledger, but the full hand-by-hand record by dealer is the owner's tool.

**Period.** A period is a run of the club's days, 06:00 to 06:00 IST, chosen on the console. The database reads at most 5,000 hands at once, newest first, and the screen says when a period holds more.

**Filters and export.** The screen filters the hands read by table, dealer and variant, and sorts any column. The export is the DataTable's, from A-029 (#102). Until #102 lands, there is no export, and no second export path is built here.

**Not shown.** Camera references wait for #122.
