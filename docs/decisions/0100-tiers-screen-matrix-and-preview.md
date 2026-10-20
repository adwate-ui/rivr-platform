# 0100: The Tiers screen saves cells in batches from a date, and previews a tier with the database's own rule

Date: 2026-10-20 · Task: #32 (additions "Tier-gated features", flow 21)

Players → Tiers (`tiers.manage`: admins and super admins) shows the tiers and the tier x feature matrix.
Each cell is one choice: on, locked or hidden. Choices made on screen are saved together from now (by
the database's clock) or from midnight IST on a later day, through `schedule_tier_cells`. Each is a new
`tier_feature` row, audited as lane 0 built it. A change already saved for later shows under its cell
and can be withdrawn until it takes effect.

`tier_matrix` gives each cell and how the feature shows to a member of that tier with no override. It
uses `feature_state`'s rule: locked names the tiers that have the feature. The preview of the player
app draws its tabs from that, so it can't disagree with what members see.

The matrix is `@rivr/ui`'s `TierMatrix`, as the task names, not the `DataTable` the spec names. It is a
real table, with feature row headers and tier column headers for screen readers, and rows that grow:
a cell's three choices need more height than `DataTable`'s fixed rows. Choosing again for a day already
scheduled replaces that day's change. The player's tab bar and the preview read one table of which tabs
a feature gates (`TAB_FEATURES` in `@rivr/contracts`). Changes in force now reach members' apps through
Realtime within seconds. A change saved for later reaches them at their next read of their access.

Seed people for this flow are in `supabase/seed/11_people_a.sql`, apart from `10_people.sql`, so that
parallel builders don't edit the same list.
