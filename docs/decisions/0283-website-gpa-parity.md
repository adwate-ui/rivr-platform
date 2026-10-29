# 0283: The website in grandpokerarena.com's way, read from settings

Date: 29 Oct 2026. Issues #616 to #619; the owner's parity list of 29 Oct and their answer: "Use placeholders for everything for now. For promotions/welcome offer/outstation/leaderboard prizes/names on leaderboards, these things are not static and should be picked from the appropriate settings".

- **The menu is fixed in the web app**, in grandpokerarena.com's order: The Club, The Room, Games, Membership, Leaderboard, What's On, Prizes & Calendar, Journal, Visit & Contact. Two of these items (The Room, Games) go to bands on the front page, which `site_page.nav_position` cannot express. `nav_position` no longer orders the website's menu. RIVR Academy is left out until the Academy is ready.
- **Band anchors** come from a block's eyebrow (`The room` becomes `#the-room`), or from its kind when it has no eyebrow (`#games`). Renaming an eyebrow in the console's editor moves its anchor.
- **Reserve a seat is a WhatsApp message** to the club. Joining the waitlist stays in the app, behind Member app.
- **Club facts are placeholders.** The phone and WhatsApp numbers (`+91 00000 00000`, which is not a real number), YouTube, the opening hours and the amenities stay placeholders until the owner gives them.
- **The cookie banner offers Essential and Maps only.** The website runs no analytics or marketing tools. The one third-party embed is the Google map, which loads only after the visitor allows maps. The choice is kept in the browser's local storage.
- **Read from settings, never written into pages:**
  - rewards, outstation, the jackpot and the rare-hand payouts, through `public_club_rules`;
  - the welcome offer and the promotions' rules and questions, from the promotions;
  - League prizes, from a new setting, `league.prizes`;
  - names on the Leaderboard, from the League as the TVs show it.
- **Helplines:** Tele-MANAS (14416) and iCall. Sources disagree on the Vandrevala Foundation's number, so it is left out until the club confirms it.
