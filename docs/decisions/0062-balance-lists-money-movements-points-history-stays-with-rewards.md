# 0062: Balance lists money movements; points history stays with Rewards

Date: 2026-10-20 · Task: #18

Balance (#18) shows the member's wallet cash, bonus in force and points balance together, as the
features spec asks, and lists the movements of their money: wallet cash, bonus, and what their
markers owe. It does not list points lines.

Points are their own ledger and never turn into cash. Their history is the tier-gated feature
`rewards.points_history`, whose screen is Rewards (lane D). Listing points lines on Balance would show
a gated feature inside a core screen with no FeatureGate, and a member who is also ledger staff would
see their own points lines whatever their tier. `public.my_wallet_movement` therefore returns only
accounts in paise; the points balance comes from `public.my_wallet`, which every tier sees.
