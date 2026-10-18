# Drill — the complete user flow, desktop and mobile

> **Copied from poker-settle (`docs/drill-engine/user-flow.md`) by Lane 0, 18 Oct 2026.**
> It describes the drill screens as poker-settle built them. RIVR's Learn tab
> rebuilds all six (Library, Hub, Session, Verdict, Summary, Review) from
> `@rivr/ui`, keeps storage on the server rather than in `localStorage`, and
> drives them from `@rivr/drills`; read the routes, file paths, tokens and
> class names below as poker-settle's, not as instructions. The engine itself is
> `packages/drills`.
>
> RIVR offers licensed titles in the Library (the scope names *The Course* by Ed
> Miller). No licensed content is reproduced here: titles, chapter names,
> principle names and page numbers in the mock-ups below are placeholders.
> Licensed encodings are uploaded at runtime by a super admin and never enter
> this repository.

A specification of every screen, state and transition in the drill feature as it
existed in poker-settle. Written to be handed to a design reviewer: it describes
what is on screen, at which width, in which state, and why — so a critique can be
aimed at decisions rather than at guesses.

---

## 0. How to open it

```
npm run dev            # Vite, http://localhost:8080 (or whatever Vite prints)
```

**Before you run it:** `.env.local` points at a local Supabase stack that is not
running, so a plain `npm run dev` gives you a sign-in page that cannot sign
anyone in. Export the two production `VITE_` variables from `.env` into the
shell first, or temporarily rename `.env.local`. The drill feature itself needs
no backend at all — it is pure client-side computation over `localStorage` — but
every `/drill` route sits behind `RequireAuth`, so you must be signed in to
reach it.

Credentials for the shared test account are in `.env.test` (`E2E_EMAIL` /
`E2E_PASSWORD`), which is gitignored. Ask the owner for them; they are the same
account the Playwright suite uses, on the production Supabase project.

Sign-in form: `/auth`, the **Sign In** tab, fields `#signin-email` and
`#signin-password`.

Once signed in, the drill routes are:

| Route | Screen |
|---|---|
| `/drill` | Hub — the home of the feature |
| `/drill/play` | Session — the drill loop, and its end-of-session summary |
| `/drill/review` | Review — leak analytics |
| `/drill/sources` | Sources — pick a book, or import your own encoding |

A first run has no source loaded, so `/drill` shows an empty state pointing at
`/drill/sources`. **Start there.** Pick a source; it downloads, validates
on-device, stores itself and drops you straight into a ten-spot session.

---

## 1. What this feature is

A spaced-repetition drill over a **specific poker book**. The user picks an
encoded strategy source; the app generates unlimited randomised spots from that
book's rules, grades each answer against the book, quotes the book's own
reasoning back with a page number, and schedules the principle for review by
FSRS.

Four properties shape every screen:

1. **It quotes, it does not generate.** Every word of feedback was authored in
   the encoding or is a fixed fallback string. The page reference is the point
   of the whole feature — it sends you back to the text.
2. **It is entirely on-device.** Source, schedule and answer history live in
   `localStorage`. There is no request to fail, no account sync, no loading
   spinner in the loop. Also: no cross-device continuity, and a cleared browser
   is a wiped history.
3. **The drawing is the question.** The poker table is not decoration; it
   carries information needed to answer. Which is why the whole spot is also
   written out in prose for screen readers, and why the visual layer is
   `aria-hidden`.
4. **Reveal order is load-bearing.** The principle's name and the strategy grid
   both give away the answer, so neither may appear before the answer is
   submitted.

---

## 2. Constraints a redesign must hold

These are not preferences. Each one is recorded because breaking it shipped a
bug or is a hard product rule.

**Visual language**
- Semantic tokens only. No hex, no `bg-green-500`. Gold (`--primary`) is the
  brand and the aggression colour.
- **No poker-themed ornament on functional screens.** No felt textures, no chip
  stacks as decoration, no card-table skeuomorphism. "Premium" in this product
  means clarity and correctness. The one real poker table on screen is there
  because it carries data.
- Typography roles are fixed: `.text-title` for a title and `.text-section` for
  a heading — both sentence case, because a heading is language —
  `font-numbers` (tabular) for anything numeric, and `.text-label` for the small
  muted caption above a value. `.text-label` is the only small caps in the app;
  never hand-roll `uppercase tracking-*`, which `drift.test.ts` fails on.
- Page shape: the container comes from `TabLayout` (`max-w-7xl`), and a page
  adds `space-y-6` and nothing else; cards `p-4 sm:p-6`. A drill page does not
  get its own `max-w-*` — see the three container roles in `DESIGN_SYSTEM.md`.
- The app's **one** disclosure affordance is the chevron-down that rotates
  180deg. Do not introduce a second grammar.

**Responsive**
- Breakpoints: `xs` 475, `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- `md` (768) is the mobile/desktop boundary for controls. Buttons are `h-12` on
  mobile, `h-10` from `md` — via `size="responsive"`, never hand-written.
- **`lg` (1024) is the drill's own boundary.** The spot card is one column below
  it and two columns above it. The action history collapses its preflop line
  below it.
- Minimum touch target 44x44 on mobile. This has been violated three times in
  this feature already (the back button, the concepts disclosure, the review's
  chip rows) and each was a real defect.
- Everything must read at 320px wide.

**Accessibility (enforced by `e2e/accessibility.spec.ts`, with an empty
`KNOWN_UNFIXED` list)**
- The scenario is read once as prose (`describeScenario`), not twice as a pile
  of card labels. The table drawing is `aria-hidden`.
- No interactive control may live inside an `svg[role="img"]` — the subtree is
  pruned from assistive tech. The answer pad is ordinary HTML below the drawing
  for exactly this reason.
- Focus moves deliberately: submitting an answer moves focus to the verdict
  heading; "Next spot" scrolls and focuses the new spot card.
- Colour is never the only signal. The strategy grid prints its hand in every
  cell and names the action in each cell's accessible name; the review heatmap
  prints the percentage and the raw counts in every cell.
- No opacity modifiers on text colours. `text-muted-foreground/70` on the grid
  put 114 of 169 cells below AA in both themes.
- Brand gold as text measures 2.04:1 and is an accepted, documented exception.
  Do not re-raise it.

**Honesty rules**
- Nothing under `MIN_ATTEMPTS` is called a leak, coloured, or judged.
- "Mastery" is retrievability across the whole book, not session accuracy —
  accuracy rises when you re-drill an easy chapter, mastery cannot.
- Set-valued dimensions in the review say so, rather than letting their columns
  look like they add up wrong.
- Engine-authored fallback feedback is labelled as not the author's words.

---

## 3. Navigation shell

Every drill screen renders inside `TabLayout`.

**Desktop (>= 640px)** — page container `max-w-7xl px-4 py-8`. A header row with
the gold "POKERSETTLE" wordmark (`h1`) on the left, theme toggle and user avatar
on the right. Below it, a centred pill-shaped nav bar: **Overview · New Game ·
Games · Players · Hands · Drill**, active item underlined with a 2px foreground
border. Drill is the sixth and last item.

**Mobile (< 640px)** — the same header at `text-xl`, no top nav bar. A fixed
bottom tab bar, 64px tall, six icon+label tabs across, `pb-safe` for the home
indicator. The active tab is gold with a small gradient tick above the icon.
Main content carries `pb-24` so the bar never covers it.

Every drill page's own title is an `h2` — the wordmark is the page's `h1`.

---

## 4. Screen by screen

### A. `/drill/sources` — Sources

**Purpose.** Pick the book. Also the door for an author importing their own
encoding.

**Desktop layout**

```
[← Back to Drilling]                                    (ghost button, top-left)

SOURCES                                                 (h2, luxury caps)
Pick a book and start drilling it. Every source is checked on this device
before it is used — nothing is uploaded, and nothing is saved to an account.

┌─ Card ───────────────────────────────────────────────────────────────────┐
│ READY TO DRILL                                                           │
│ Encoded from the book and checked before shipping. Each one is           │
│ downloaded only when you pick it.                                        │
│                                                                          │
│ ┌ 📖  <Licensed title>                              [ Use this source ] ┐│
│ │     <Author>                                                          ││
│ │     <blurb>                                                           ││
│ └───────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘

[ 🗎 Import an encoding of your own ]                    (ghost, collapsed)
```

**Mobile.** Identical, one column. The source row wraps: icon and text block
(`min-w-[14rem]`) on the first line, the "Use this source" button drops beneath.

**States**
- *Idle* — as drawn. Only one built-in source ships today, so the "shelf"
  is a list of one.
- *Loading* — the picked button shows a spinner and reads "Loading…"; all other
  source buttons disable.
- *Import panel open* — appends a second card: a dashed drop zone (highlights
  gold on drag-over), a 10-row monospace textarea, `Validate` and `Clear`.
- *Validation passed* — a card appears: "This source is sound…" with a
  `Load and drill` button.
- *Validation failed* — `ValidationReport` renders the findings with line
  numbers.
- *Load error / wrong file type* — a `role="alert"` line in `--state-error`,
  rendered outside the import panel so it is visible even when collapsed.

**Transitions.** Picking a built-in source you have never drilled goes straight
to `/drill/play` with a 10-spot due-scoped session. Picking one you have already
been drilling goes to `/drill` instead — you came back for your own queue.

---

### B. `/drill` — Hub

**Purpose.** The home of the feature. Choose what to drill and how long, see how
much of the book you know, or go read what a chapter teaches.

Two rules it holds to: **the common case is one tap**, and **no state is a dead
end** — even "nothing due" offers something to do.

**Desktop layout**

```
<Author>                                                   [ Sources ]
<LICENSED TITLE>                                           (h2)

┌ Due now ┐ ┌ Mastery ┐ ┌ Answered ┐ ┌ Accuracy ┐          4-up stat tiles
│   12    │ │   34%   │ │   118    │ │   71%    │
└─────────┘ └ 23 of 69│ └──────────┘ └──────────┘
             met     ┘

┌─ FILTER SPOTS ───────────────────────────── (2) ── [Clear All] ── ⌄ ─────┐
│  Street    [Preflop][Flop][Turn][River]                                  │
│  Stakes    [1/2][2/5][5/10]…                                             │
│  Your leaks  [Only my 3 weak principles]      (or the "not enough yet"   │
│                                                copy, with MIN_ATTEMPTS)  │
│  The game  [Typical][Loose passive][…]        (only when the source has  │
│                                                modifiers for it)         │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Card ───────────────────────────────────────────────────────────────────┐
│ [ ▶ Continue · 20 spots ]   [10 spots][20 spots][50 spots][Open-ended]   │
│ 12 due now.                                                              │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Card ───────────────────────────────────────────────────────────────────┐
│ BY CHAPTER                                                               │
│ Drill the part of the book you just read, rather than whatever is due.    │
│                                                                          │
│ ┌ 📖  <Chapter 1 title>                    9 principles  62% mastered  [3 due] ┐
│ │     ⌄ What this chapter teaches · 4 ideas                              ││
│ └───────────────────────────────────────────────────────────────────────┘│
│ ┌ 📖  <Part 1 title>                concepts only  ⌄ …  ┐  (dashed, not a button)
│ └───────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘

[ See where the leaks are ]                                (ghost)
```

**Mobile.** Stat tiles go 2x2. Header wraps, "Sources" drops below the title.
Filter chips wrap to multiple rows. The start button and the four length chips
wrap — on a 390px phone this is typically 3 rows of controls. Chapter rows wrap
their metadata onto a second line.

**States**
- *No source loaded* — full-page `EmptyState`: target icon, "No source loaded",
  the on-device promise, and a `Choose a source` button. This is the true first
  screen of the feature.
- *Source updated in the background* — a success toast: "This book has been
  updated / A corrected encoding shipped since you picked it. Your progress is
  kept."
- *Fresh book* — Due now equals the whole drillable set, Mastery 0%, Answered 0,
  Accuracy "—". Start button reads "Continue · 20 spots".
- *Filters narrowed, spots due* — button reads "Drill · 20 spots"; caption
  "N due now."
- *Filters narrowed, nothing due but a non-empty pool* — caption: "Nothing is
  due in this scope — the session deals fresh spots from its N principles
  anyway."
- *Fewer due than the session length* — "N due now; after those, fresh spots
  from the same scope until the session is done."
- *Filter combination the book cannot satisfy* — button disables and reads
  "Nothing matches", plus "Nothing in the book matches all of those at once.
  Drop a filter and it fills back in."

**Known tension.** The primary action sits in the third block down, after four
stat tiles and a filter panel. On a phone, "Continue" is usually below the fold.

---

### C. `/drill/play` — the spot (unanswered)

**Purpose.** Ask one question. Everything needed to answer it must be on one
screen, without scrolling, on a laptop and on a phone.

**Desktop layout (>= 1024px)** — the spot card splits `3fr / 2fr`.

```
[←]  Chapter 1 · flop           12 correct of 17 right · 71%   [ End session ]
     4 of 20

▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   (Progress, 15%)

┌─ The spot (focusable, aria-label="The spot") ────────────────────────────┐
│                                            │                             │
│  A single-raised pot, 100bb deep           │  ACTION SO FAR              │
│  Your hand  [A♠][K♦]                       │   Preflop                   │
│  [95bb behind][SPR medium][large bet]      │    CO   Villain 1  raise 3bb│
│  [vs Station]                              │    BTN  You        call     │
│                                            │   Flop                      │
│  ┌────────── PokerTableView ───────────┐   │    CO   Villain 1  bet 8bb  │
│  │  9 seats, plates "Villain 1 · CO",  │   │    BTN  You        …to act  │
│  │  folded seats greyed + mucked,      │   │                             │
│  │  board face-up in the middle,       │   │  YOUR ACTION                │
│  │  pot badge, bets in front of seats, │   │   [Fold][Call][Raise]       │
│  │  hero's seat active. 16:9.          │   │                             │
│  └─────────────────────────────────────┘   │  HOW MUCH  (only if the     │
│                                            │   action takes a size)      │
│                                            │   [Small ≤½ pot][Medium]    │
│                                            │   [Large][All in]           │
│                                            │                             │
│                                            │   [      Answer      ]      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Mobile / tablet (< 1024px)** — one column, in this order: spot summary, poker
table (4:3 aspect, `-mx-2` bleed), action history, answer pad. The preflop line
of the history collapses to a one-tap chevron row ("Preflop · 5 actions") as
soon as there is a board, because the full history ran ~470px of a 727px phone
and pushed the answer pad off the bottom.

**The header row** carries four things: a 48px back arrow (the only way out),
the scope description, the position counter, the running score, and "End
session". The running score is deliberately a single line of text, not a row of
stat tiles — tiles cost 110px directly above the spot and pushed the pad off a
900px screen.

**States**
- *Position counter* reads `4 of 20`, or `12 answered` when the session is
  open-ended. It counts the spot **on screen**, not the next one.
- *Progress bar* is present only for a fixed-length session.
- *Nothing generatable in scope* — `EmptyState`: "Nothing to ask here", with
  either "Nothing in this scope can be asked yet. N more unlock as their
  prerequisites stick" or "Nothing in the book matches this scope", and a
  `See how it went` button.
- *Generator failure on one principle* — a card with a `role="alert"` line and a
  `Skip it` button.
- *No source* — the same "No source loaded" empty state as the hub.
- *Arrived directly* (bookmark, refresh) — starts a default 20-spot due-scoped
  session rather than showing an error.

---

### D. `/drill/play` — the verdict (answered)

The spot card stays exactly where it is; the answer pad unmounts and two blocks
append below.

```
┌─ Verdict card ───────────────────────────────────────────────────────────┐
│ ✕  TOO AGGRESSIVE   [You said · Raise large]  [Book says · Call]         │
│                                                                          │
│ <the author's own sentence about this mistake>                           │
│                                                                          │
│ ─────────────────────────────────────────────────────────────────────    │
│ WHY                                                                      │
│ <principle name>                                                         │
│ <the author's rationale>                                                 │
│ Page <n>                                                                 │
│                                                                          │
│ [ Next spot ]                                                            │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Strategy grid (preflop only) ───────────────────────────────────────────┐
│ WHAT THIS SOURCE DOES HERE   [■ Raise 3bb] [■ Call] [□ Fold]            │
│ 13x13 grid, your hand ringed with a 2px foreground ring                  │
│ Your hand is ringed. Every other square is what this source does with     │
│ that hand in this exact spot — same seat, same opponent, same action.     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Design rules inside the verdict**
- Both halves of the comparison are labelled and neither is tinted. The
  verdict's colour lives on the icon and the title only — a red "Book says
  check" read as though *you* had checked.
- Seven verdict classes: Correct, Too loose, Too tight, Too passive, Too
  aggressive, Right action wrong size, Right idea wrong spot.
- Optional extra lines: a "secondary line" badge; a note that the answer is what
  this rule gives for a different coordinate; a note that the feedback is the
  engine's neutral wording rather than the author's.
- Focus lands on the verdict heading. "Next spot" smooth-scrolls the new spot
  card into view and focuses it.

**Mobile.** Everything stacks. The strategy grid has a `min-w-[20rem]` floor and
scrolls inside its own focusable region on the narrowest phones — below that
floor 141 of 169 cells clipped their own label.

---

### E. `/drill/play` — the summary

Replaces the whole page once the session runs its length or "End session" is
pressed.

```
Chapter 1 · flop                                      (scope description)
SESSION DONE                                          (h2)

┌ Answered ┐ ┌ Correct ┐ ┌ Accuracy ┐                 3-up, 2-up on mobile
│    20    │ │   14    │ │   70%    │
└──────────┘ └─────────┘ └──────────┘

┌─ Card ───────────────────────────────────────────────────────────────────┐
│ WORTH RE-READING          (or "NOTHING MISSED")                          │
│ [2 wrong of 3]  <principle name>                           p.<n>         │
│ [1 wrong of 4]  <principle name>                           p.<n>         │
└──────────────────────────────────────────────────────────────────────────┘

[ Drill this again ]  [ Back to drilling ]  [ See where the leaks are ]
```

Most-missed first. "Drill this again" reuses the same scope and length.

---

### F. `/drill/review` — Review

**Purpose.** Find leaks the book never taught, by cutting your mistakes by
attributes the generator varied.

**Desktop layout**

```
[← Back to Drilling]

<Licensed title>
REVIEW                                                (h2)

┌ Attempts ┐ ┌ Correct ┐ ┌ Accuracy ┐ ┌ Median time ┐   4-up (2x2 on mobile)
│   118    │ │   84    │ │   71%    │ │    6.4s     │
└──────────┘ └─────────┘ └──────────┘ └─────────────┘

┌─ Card ───────────────────────────────────────────────────────────────────┐
│ CUT BY  [ Stack depth      ⌄ ]        (Select, max-w-xs — not 13 chips)  │
│ (set-valued note here when the dimension can carry more than one value)  │
│                                                                          │
│ Stack depth        Spots   Wrong   Rate                                  │
│ short                 12       2    17%                                  │
│ medium · too few…      3       1    33%   (greyed)                       │
│ deep                  41      18    44%                                  │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Card ───────────────────────────────────────────────────────────────────┐
│ CROSSED WITH                                                             │
│ STACK DEPTH AGAINST STREET                                               │
│ One cut finds a bad street. Two find the bad street at one stack depth    │
│ and nowhere else, which is a page to go back to rather than a mood.       │
│                                                                          │
│ CROSSED WITH  [ Street  ⌄ ]                                              │
│                                                                          │
│ (focusable, horizontally scrolling heatmap — 4 named bands, never a       │
│  gradient; each cell prints "44%" over "18/41"; insignificant cells       │
│  are grey, not coloured)                                                 │
└──────────────────────────────────────────────────────────────────────────┘

┌─ Card ───────────────────────────────────────────────────────────────────┐
│ LEAKS                                                                    │
│ WORSE THAN YOUR OWN BASELINE                                             │
│ [44%]  deep   18 wrong of 41, against a 26% baseline                     │
└──────────────────────────────────────────────────────────────────────────┘

[ Clear history ]  [ Reset schedule ]                  (both destructive,
                                                        both confirm)
```

Thirteen cut dimensions: Principle, Stakes, Street, Position, Pot type, Players,
Stack depth, Opponent, Hand class, Hand strength, Board texture, Draws, Mistake.

**States**
- *No attempts* — `EmptyState`: "Nothing to review yet", with an explanation of
  what the page will do, and a `Start drilling` button.
- *No leaks* — "Nothing here is confidently worse than the rest of your play.
  That is either good news or too few spots."
- *Clear history* / *Reset schedule* — two separate confirmations, each stating
  exactly what survives. They are separate because one button used to destroy
  both.

**Known tension.** The heatmap is the most information-dense object in the app
and it is the piece least adapted for a phone — 13 hand classes against 10
positions scrolls sideways inside its box at every mobile width.

---

## 5. The journeys end to end

**First run.** `/drill` (empty) → `Choose a source` → `/drill/sources` → *Use
this source* → validates on-device → stores → **straight into a 10-spot
session** at `/drill/play`. The hub is skipped deliberately: on a book you have
never touched, the hub's only real offer is "Continue", so making you press it
is a screen for its own sake.

**Returning.** Bottom tab / nav → `/drill` → read Due now and Mastery → one tap
on "Continue · 20 spots" → 20 spots → summary → "Back to drilling".

**Targeted.** `/drill` → open Filter Spots → tap *Turn* and *Only my 3 weak
principles*, or tap a chapter row in *By chapter* → the caption recomputes live
→ "Drill · 20 spots".

**Diagnostic.** Summary or hub → "See where the leaks are" → `/drill/review` →
cut by Stack depth against Street → find a red cell with a real denominator →
back to the hub, filter to it, drill it.

**The loop itself.** Spot → choose action → (choose size) → Answer → verdict +
grid → Next spot → the new spot scrolls into view and takes focus. Repeat until
the progress bar fills.

---

## 6. What to check

Aimed questions, in rough priority order.

**Fit and hierarchy**
1. On a 390x844 phone, how much scrolling does one spot require between "I can
   see the question" and "I can press Answer"? This has been fought three times
   and is the feature's defining constraint.
2. The hub puts four stat tiles and a filter panel above its primary action. Is
   that the right order for a screen whose common case is one tap?
3. The session header carries five things in one row (back, scope, position,
   score, end). Does it survive 320px, and is the running score legible where it
   is?

**The spot**
4. At `lg` the spot is a 3fr/2fr split — table left, history and pad right. Is
   the answer pad in the right place, or should it be pinned?
5. The hero's hand is stated above the table *and* drawn on the felt. Is stating
   it as two small cards next to a "Your hand" label the strongest form?
6. The 4:3 table on mobile: nine seat plates, five board cards and a pot badge in
   roughly 343x257. What loses, and what should?

**The verdict**
7. Two outline badges — "You said · Raise large" and "Book says · Call" — carry
   the entire comparison, uncoloured by design. Does the comparison read
   instantly, or does the uncoloured treatment cost too much?
8. The page reference is the product's whole reason to exist and currently
   renders as a small muted line at the bottom of the "Why" block.
9. The strategy grid appears only after answering, only preflop. Is the
   transition from verdict to grid legible as one thought?

**Review**
10. Thirteen dimensions in two Selects, feeding a heatmap. Is a Select the right
    control, and does the two-dimension cross explain itself?
11. The four-band heat plus a printed denominator in every cell: does it stay
    honest and stay readable at phone width?

**Across the whole flow**
12. Is it obvious at any moment where you are in the four-screen set, and how to
    get back to the hub?
13. Both themes, at 320 / 390 / 768 / 1024 / 1440.
14. Empty states: no source, nothing in scope, nothing due, no attempts, no
    leaks, generator failure. None of them may be a dead end.
15. Does the feature look like it belongs to the same app as Games, Players and
    Hands — or like a second product bolted on?

---

## 7. Reference numbers

| Thing | Value |
|---|---|
| Page container | `space-y-6` only — the width is `TabLayout`'s `max-w-7xl px-4` |
| Card padding | `p-4` mobile, `p-6` from `sm` |
| Spot card split | `lg:grid-cols-[3fr_2fr]`, `gap-4` / `lg:gap-6` |
| Poker table | `aspect-[4/3]`, `sm:aspect-[16/9]`, `max-h-[85vh]` |
| Strategy grid | 13x13, `min-w-[20rem] max-w-[32rem]`, cells `aspect-square text-3xs` |
| Bottom nav | fixed, `h-16`, `sm:hidden`, content padded `pb-24 sm:pb-0` |
| Button heights | `h-12` mobile / `h-10` from `md` (`size="responsive"`) |
| Session lengths | 10, 20, 50, open-ended |
| Significance floor | `MIN_ATTEMPTS` (`crosstab.ts`) — below it, nothing is judged |

**Source files**

| Screen | File |
|---|---|
| Hub | `src/pages/DrillHub.tsx` |
| Session + summary | `src/pages/DrillSession.tsx` |
| Review | `src/pages/DrillReview.tsx` |
| Sources | `src/pages/DrillSources.tsx` |
| Spot pieces | `src/components/drill/{SpotSummary,ScenarioScene,ActionHistory,AnswerPad,GradeReveal,HandInRange,StrategyGrid,ValidationReport}.tsx` |
| Shell | `src/components/layout/TabLayout.tsx` |
| Rules | `DESIGN_SYSTEM.md`, `tailwind.config.ts` header |
