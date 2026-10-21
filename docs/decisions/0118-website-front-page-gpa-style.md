# 0118: The website's front page in the Grand Poker Arena style

Date: 2026-10-21 · Task: #441 (the owner's request; the spec's "GPA style" for the website)

**The page.** The front page is a long scroll of full-bleed bands, as grandpokerarena.com's is, in RIVR's own colours and type:
- dark: green-black;
- deep: green;
- cream: with ink text.

Each website block sits in a `WebBand`, and the website gives each kind its band, so the bands alternate as the page reads. Three kinds are new:
- `statement`: a line or three set large;
- `gallery`: photo tiles;
- `feature`: one picture beside its words.

The hero takes an eyebrow, a muted room loop and a note.

**An exception to the UI rules, for the public website only** (`.claude/rules/ui.md`, "Public website"). It may use:
- cream bands;
- the club's own photos and video;
- a dark overlay on them so their words stay legible, flat or fading to the foot of a photo tile under its caption;
- a muted looping video in the hero, which shows its still when the visitor asks for reduced motion;
- one gold filled button per band.

Its headlines may be short statements ("Bring your poker face."), as the club's teaser is. App screens keep every rule as it was.

**Media.** The stills and the room loop are cut from the club's launch teaser and served by the website from `apps/web/public/media` (WebP, H.264). The teaser labels them "Concept visualisation", so the website says so beside them. The app's picture is a real screenshot of the player app.

**Content.** No console editor exists yet (C-020), so the seed owns the club's front page: `40_site.sql` replaces its blocks each time it runs, staging's deploy included. That ends when the editor lands. The owner chose the headline and "Opens Sunday 15 November" on 21 Oct.
