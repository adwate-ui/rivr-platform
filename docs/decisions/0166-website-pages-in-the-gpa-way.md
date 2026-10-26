# 0166: The website follows grandpokerarena.com page by page, in RIVR's words

Date: 2026-10-26 · Task: owner request (26 Oct); extends decision 0118

The owner asked to copy grandpokerarena.com "to the fullest extent while using our assets/placeholders". The site now follows GPA's structure, page by page:
- the front page, in GPA's order of bands: hero, a line of phrases, the story with its figures, what the club stands for, the room, games, hospitality, the standard, the law, membership, the app, what's on, the calendar, the journal, questions, the last word and where to find it;
- About, Membership, Promotions, Tournaments, the Journal with four articles, and Terms;
- the header lists the club's pages, and the footer the policies (house rules, questions, responsible play, privacy, terms).

**Words and media.** All copy is RIVR's own, written from what the club is and does, not GPA's text. GPA's copy describes a different club in another state, and copying it would put its claims in RIVR's name. Every image is the club's own media.

**Placeholders.** What only the owner can say is marked as a placeholder:
- the points rates, shown as examples until question #395 is answered;
- the Black card's terms;
- the terms of use;
- the club's phone number, which the contact block shows once it is given.

Nothing describes a feature not yet built. Tournament registration is "at the cage" until the app takes it.

**The law.** The legal band cites only the two Supreme Court cases that set the skill test (1968, 1996). It makes no claim about Haryana; the owner's counsel adds that.

**How it is built.** Six block kinds, chosen so one kind serves many of GPA's bands rather than one each:
- `story`: words beside a photo, with up to four figures;
- `cards`: a grid that serves pillars, the room, hospitality, the standard, tiers, steps, what's on and the journal list, linking only to the site's own pages;
- `marquee`: a still line of phrases, with no motion;
- `timeline`;
- `table`: every row as long as the columns;
- `promotions`: live, from `public_promotion_cards`.

The map block gains a phone number and an email. Seed `43_site_gpa.sql` owns these pages until the console edits the website (C-020).
