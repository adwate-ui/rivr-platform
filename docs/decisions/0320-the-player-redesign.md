# 0320: The player app's redesign

Date: 3 Nov 2026. The owner approved a redesign of the player app, "Direction 1b, Live night": the brief and its prototype are in `docs/design/player-redesign/` (`player-prototype.dc.html`; its markup holds the layout values and copy, its `class Component` the states and timings). Where the brief and the prototype differ, the prototype wins on looks and copy, the brief on data.

- **The design source moves for the player app.** `docs/design/prototype.html` stays the reference for the console, tablet, TV and website. The player app follows the redesign.
- **Tokens it adds** (`packages/tokens/tokens.json`), so no screen holds a raw value:
  - colours, all tints of the six brand colours bar one: `goldTint` (14%), `goldEdge` (35%), `creamTrack` (12%), `creamFaint` (30%), `seatTaken` (35%), `skeleton` (8%), `skeletonFaint` (5%), `scrim`, and `rim`, the seat map's wooden edge;
  - type sizes 32, 40, 72 and 160;
  - sizes for its fixed shapes: the call-time ring, the seat map, the selfie oval, the offer card;
  - motion: a sheet slides up in 240 ms; a live ring or bar moves on each second, linear; a toast stays 3.2 s.
- **Two radii past 6 px.** The redesign rounds an offer card, the QR's panel and the membership card at 8 px (`radius.card`; the prototype's card is 10, within the brief's 2 px) and a bottom sheet's top corners at 16 px (`radius.sheet`). The 6 px ceiling still holds for every other product surface, and the token test names the two exceptions.
- **The alert system.** Four patterns and nothing else: Banner (top of Tonight), Toast (confirms the member's own action, with Undo when it can be undone), Push (outside the app: Seat ready and Call time ending only) and the field error.
- **Components `ui.md` had kept out.** The redesign needs a Toast, a Sheet, skeleton blocks and a picker; each is added to `@rivr/ui` through the `new-ui-component` skill.
- **Where the app keeps the prototype's copy against `copy.md`.** The identity screens' "We store…", "We're checking…", "We'll notify you" and "We couldn't verify you" are the prototype's words, approved with it; `copy.md`'s "never say we" gives way to them here only.
- **Known differences from the prototype, kept for now (issues):** the wordmark's sign-in and header sizes, the switches' 40×24 track (46×28 in the prototype), item tiles at 4:3 rather than square, and the send bar's count beside its label rather than at the right. A paused club and an offline phone also show a banner at the top of every other screen, as `apps.md` never hides a paused club.

