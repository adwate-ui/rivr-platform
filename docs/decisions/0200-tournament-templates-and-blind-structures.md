# 0200: Tournament templates, blind structures and the calculator

Date: 2026-10-26 · Task: #115

A **blind structure** is a venue's named run of stages: levels (small blind, big blind and ante in chips, and minutes) and breaks (minutes). It is kept as JSON on `blind_structure.levels`; `private.blind_levels_problem` and `@rivr/domain` `structureProblem` agree on what the clock can run: one to sixty stages, a level first, never two breaks together, each stage 1 to 120 whole minutes, a small blind of at least one chip and at most the big blind.

A **template** names a structure with a format (decision 0202), a buy-in with its fee inside it, a starting stack, the last registration level, the most buys, an optional add-on (price, fee, chips), the places paid and an optional guarantee. Amounts are ₹50 chips.

- **Copies, not references.** A tournament made from a template copies everything, the levels included. Changing a template or structure never moves a running clock or changes what was sold. So `tournament` gains the template's columns, and `tournament_level` from the lane contract is not a table.
- **Calendar entries.** Tournaments made before templates have no levels; their clocks cannot start. The seed gives the three seeded tournaments their templates.
- **The calculator** (`planStructure`) fills the levels for a target length: as many levels as fit with their breaks, big blinds climbing the chip ladder (100, 120, 150, 200, 250, 300, 400, 500, 600, 800, ×10) evenly from the first big blind to a twentieth of the chips in play, the small blind half, an optional big-blind ante. The floor then edits any level. It is a proposal, so it has no SQL twin.
- **Seed.** RIVR Sunday: ₹10,000 with a ₹1,000 fee (₹9,000 to the pool), 30,000 chips, 20-minute levels, re-entry to the end of level 9, top 8 paid, ₹5,00,000 guaranteed; level 7 is 400/800 ante 800.
