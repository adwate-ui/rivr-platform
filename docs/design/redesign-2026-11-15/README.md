# RIVR redesign reference pack, 15 Nov 2026

Put this folder at `docs/design/redesign-2026-11-15/` in `rivr-platform`.

- `screens/` holds 82 renders of the approved prototype. File names are `<flow>-<step>.png`, in the order the flow was clicked. In the step, `q` is the player app (390 x 844), `c` is the ops console (1440 x 900), `t` or a board name is the TV. The login and TV files carry descriptive names.
- `prototype-source.dc.html` is the prototype's source. It does not run outside its host. Read it for copy and behaviour.
- The prototype's data is sample data. Fonts in these renders are fallbacks; use the tokens in `packages/tokens`.
- Where a render shows less than the existing screen, the existing screen stands. See the brief.

Flows: login-and-club-details, signup-club-kyc, signup-app-kyc-and-notices, desk-id-check, tables-setup, settings, add-time-and-bonus-by-hand, high-hand-and-promotions, notice-rule-and-high-hand-payout, console-table-columns, column-menus, tv-boards.
