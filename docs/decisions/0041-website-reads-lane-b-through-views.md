# 0041 The website reads the floor and the schedule through lane B's public views

Date: 19 Oct 2026. Task #35.

The website's games and stakes and its tournament calendar (#35) need lane B's data before lane B's tournament tasks (#115, #116) exist. Rather than wait, #35 adds what the contract already names for the website:

- `public_table_status` and `public_tournament_calendar` (lane B's contract views, `docs/contracts/lane-b.md`), as security-definer row functions behind security-invoker views: no personal data, never the practice venue. The website reads only these, never `game_table`, `table_type` or `tournament`.
- A minimal `public.tournament` schedule: name, start, whole buy-in (fee included), guarantee and whether it is published. Lane B owns it from here: #115 and #116 add formats, blind structures, the pool and fee split, entries and the clock by migration, and may change how the view computes its columns, keeping its shape.
- Reads only: members see their venue's published tournaments, staff every tournament at their venues. Writes come with lane B's console screens.

One person builds every lane at present, so this is recorded here rather than raised as a question.
