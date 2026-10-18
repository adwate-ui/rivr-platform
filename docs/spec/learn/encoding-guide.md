# Encoding a new source

> **Copied from poker-settle (`docs/drill-engine/encoding-guide.md`) by Lane 0,
> 18 Oct 2026, and adapted to RIVR.** Paths, commands and gate names point at
> `packages/drills`. Every example below is invented; no licensed source is
> quoted or transcribed here. Licensed encodings are uploaded at runtime by a
> super admin, validated by the same engine, and never enter this repository.

How to turn a strategy book — or a video course, or your own notes — into a drill
source the app can generate spots from, grade against, and space out over weeks.

This is the end-to-end procedure. The reference it leans on:

- **[`poker-ontology-v1.schema.json`](../../../packages/drills/src/ontology/poker-ontology-v1.schema.json)**
  — the authoritative shape. Every field, every enum value, every description. If
  this guide and the schema ever disagree, the schema is right.
- **The validator** (`packages/drills/src/validator/`) — the six stages every
  import passes, with a stable code for every finding.

The worked example the test suite and the CI gates are built on,
[`example-encoding.json`](../../../packages/drills/fixtures/example-encoding.json),
is a valid two-principle payload with invented quiz hands; read it alongside this
guide as a shape you can copy.

Current ontology version: **2.0**. Everything below is written against it.

---

## 0. The one rule everything else serves

> **If the source has no opinion about a spot, the spot must not be asked.**

Silence is a legitimate answer for an encoding. The single most expensive thing a
teaching tool can do is convert silence into confident wrong advice — it teaches
the wrong thing *and* destroys trust in everything else it says. Every technique
in this guide (abstention over defaults, situations no wider than the passage,
per-outcome feedback) exists to keep that from happening.

---

## 1. The shape of a source

A source is one JSON file. In RIVR a super admin uploads it from the console; the
engine validates it before it is stored, and the drill reads it at runtime. The
only encodings in the repository are invented fixtures in
`packages/drills/fixtures/`, which the CI gates read. The top level:

```jsonc
{
  "ontology_version": "2.0",
  "source":        { /* who wrote it, and the numbers it reasons in */ },
  "opponent_types":[ /* the source's own names for kinds of opponent */ ],
  "range_sets":    [ /* preflop hand lists, in standard notation */ ],
  "source_units":  [ /* chapters, for drilling one at a time (optional) */ ],
  "principles":    [ /* the decisions — the substance */ ],
  "quiz_hands":    [ /* the source's own worked examples, for the fidelity gate */ ]
}
```

`ontology_version`, `source`, `opponent_types`, `range_sets` and `principles` are
required; `source_units` and `quiz_hands` are optional but you want both.

### `source`

```jsonc
{
  "id": "src_example_course",
  "title": "An Example Strategy Book",
  "author": "A. Author",
  "kind": "book",                       // book | video_course | article_set | personal_notes
  "state": "draft",                     // draft | importing | validating | active | archived
  "table_size": 9,
  "stack_brackets":     { "short_max": 60, "standard_max": 199, "deep_max": 299 },
  "spr_brackets":       { "very_low_max": 2, "low_max": 4, "medium_max": 8 },
  "raise_size_brackets":{ "small_max": 2.5, "standard_max": 4 },   // PREFLOP: multiples of the pot
  "bet_size_brackets":  { "small_max": 0.5, "standard_max": 0.64 },// POSTFLOP: pot fraction (1.7)
  "quiz_pass_threshold": 0.85
}
```

- **`state` decides whether the gates can fail the build.** A source at `active`
  that misses its `quiz_pass_threshold` fails, and so does one that fails the
  `mece`, `generator`, `overclaim`, `feedback`, `lines`, `winnable` or `variety`
  gate; at any other state every gate still runs and prints its FULL findings
  but does not fail. Encode at `draft`, flip to `active` only once everything
  clears — an in-progress source blocking CI is a permanent amber light everyone
  learns to ignore. Some things fail at ANY state: a structurally invalid source,
  a stale gate allowlist entry, and an ungoverned generated spot (a crash, not a
  finding). So does a **perfect score**, on either metric: a raw pass rate of
  100% on ≥ 20 scored hands, or accuracy-on-matched of 100% on ≥ 20 matched
  hands. Either means the encoding was fitted to its corpus (or the corpus is
  in-sample), not that it is faithful. The second condition exists because
  coverage holes dilute the raw rate: a fit that narrows rules and abandons
  coverage reads as a modest pass rate over a perfectly-answered matched set.
- **Record `state_changed_on` whenever `state` changes.** A non-active state is
  a loosening, so every suppressed gate run prints how long it has lasted and
  warns past 30 days — the suppression must not become permanent by inattention.
- **Set `quiz_pass_threshold` BEFORE the first validation run**, and do not touch
  it afterward. It is the bar you commit to, not a dial you turn until the number
  is green.
- **The bracket tables are the source's own vocabulary**, and every sizing in the
  encoding is read off them (see §6). Derive the boundaries from the source's own
  worked numbers, not from your ear.

### `opponent_types`

The source's own names for the people at the table, each mapped onto a canonical
archetype the engine understands:

```jsonc
{
  "id": "opp_weekend_regular",
  "label": "Weekend regular",
  "canonical_archetype": "unknown",     // one of the fixed VILLAIN_ARCHETYPES
  "aliases": ["Recreational regular"],
  "behavioural_tags": ["limps too often", "calls one street too many"]
}
```

`aliases` and `behavioural_tags` are documentation; only `id`, `label` and
`canonical_archetype` are read by code. A principle names opponents by their
source-scoped `id`, in `situation.villain_types`.

### `range_sets`

Preflop hand lists, in standard notation — never as combo lists; the code expands
them:

```jsonc
{ "id": "rs_early_open", "label": "Early-seat opening range",
  "hands": ["33+", "A9s+", "KTs+", "QJs", "JTs", "AJo+", "KQo"] }
```

Notation: `AKs`, `QQ`, `77+`, `ATs-A7s`. A set may be `derived_from` a parent id
with `excludes`, to say "the early range minus the weakest suited hands" without
restating it.

### `source_units`

Chapters, so a reader can drill one at a time. `{ "id", "label", "order",
"page_ref" }`. A principle points at one with `source_unit_id`.

---

## 2. A principle, field by field

A principle is one decision the source teaches. This is the substance of the
encoding.

```jsonc
{
  "id": "pr_turn_raise_small_lead",
  "source_id": "src_example_course",
  "source_unit_id": "unit_turn_play",
  "page_ref": "88",
  "name": "Raise a small turn lead",
  "tier": "advanced",              // the source's own difficulty tier, optional
  "confidence": "high",            // high | medium | low
  "status": "active",              // active | disputed | overridden | retired
  "drillable": true,
  "rule":      { /* what to do — §3 */ },
  "rationale": "…",                // the source's argument, in its words — §5
  "feedback":  { /* why each answer is right or wrong — §5 */ }
}
```

Required: `id`, `source_id`, `name`, `rule`, `rationale`, `feedback`.

- **`drillable: false` makes it a concept**, not a decision drill — recall of an
  idea the source raises but never turns into a spot ("position is worth more in
  bigger pots"). Set this rather than inventing a rule to fill the field.
  Concepts still need a `rule` structurally (use a bare `{ "kind": "predicate",
  "situation": {}, "branches": [], "default": {...} }`) but are never generated
  from.
- **`page_ref` is a pointer only.** Source text is never carried into the app —
  except as the words you choose to put in `rationale` and `feedback` — and never
  into this repository.

---

## 3. The rule: what to do

Four kinds. Each carries a `situation` (§4).

### Predicate rule — the common case

```jsonc
{
  "kind": "predicate",
  "situation": { /* who this claim is about */ },
  "branches": [ { "when": { /* a narrower situation */ }, "then": { /* outcome */ } } ],
  "default": { /* outcome */ }        // OPTIONAL since 1.2 — see below
}
```

Branches are **ordered, first-match-wins**, and evaluated after the rule's own
`situation` has already claimed the spot. A branch *picks the answer*; only
`situation` decides *which spots the rule claims*. The validator (stage 5) refuses
two branches that can both match with different outcomes, so ordering never hides
an ambiguity.

**Omit `default` to abstain.** A predicate rule with no default declines any spot
its branches do not cover — the spot passes to the next principle, or is reported
as an honest coverage gap, instead of being answered by a catch-all. This is the
single most important tool for obeying §0. A default that mops up "everything the
branches excluded" is exactly how a rule once told a reader to fold a flush; the
`overclaim` gate exists to catch it.

### Range-lookup rule — preflop decisions

```jsonc
{
  "kind": "range_lookup",
  "situation": { "street": ["preflop"], "hero_position": ["UTG","UTG1","UTG2","LJ","HJ"], … },
  "range_set_id": "rs_early_open",
  "in_range":     { "action": "raise", "sizing": "medium", "feedback": {…} },
  "out_of_range": { "action": "fold",  "sizing": "unspecified", "feedback": {…} }
}
```

`in_range` and `out_of_range` are **both optional since 1.5**, and an omitted side
**abstains**. This is how a three-tier preflop decision (3-bet the premiums / call
the middle / fold the rest, all facing one raise) is encoded as three rules that
can never contradict: each answers only the tier its passage names, and abstains
on the others.

### The outcome

```jsonc
{ "action": "raise", "sizing": "large",
  "acceptable_alternatives": [ { "action": "raise", "sizing": "small" } ],
  "feedback": { "correct": "…" } }
```

- `action` is required; `sizing` is one of `small | medium | large | all_in |
  unspecified`. **Sizing is graded only when specified** — use `unspecified` (or
  omit it) where the source gives an action but no size, and the answer is graded
  on action alone.
- `acceptable_alternatives` are the lines the source calls close. They grade
  **correct** and are flagged as a secondary line. This is how "you can raise or
  just call here" is expressed — not with a frequency or a mixed strategy, which
  the ontology deliberately has no room for.
- **`outcome.feedback` (1.7):** where a rule has more than one right answer, each
  outcome must say why it is right — see §5.

### Classify rule — the answer is a label (1.9)

Some of what a source teaches is a reading, not a decision: "did this flop hit
the caller's range hard or miss it?", "is this turn a scare card or a blank?".
Encoding that as an action means inventing a bet the page never recommends. A
classify rule answers with one of its own labels instead:

```jsonc
{
  "kind": "classify",
  "situation": { "street": ["flop"], "villain_types": ["opp_station"], "board_require": ["high", "static"] },
  "labels": [ { "id": "hit_hard", "label": "Hit it hard" }, { "id": "missed", "label": "Missed it" } ],
  "perspective": "villain",          // whose cards the dealt hand is: "hero" or "villain"
  "prompt": "The station called your raise. Did this flop hit the hand hard, or miss it?",
  "branches": [ { "when": { "hand_class_any": ["top_pair_good_kicker", "overpair", "set"] },
                  "then": { "label": "hit_hard" } } ],
  "default": { "label": "missed" }
}
```

- **Labels are the rule's own**, `{ id, label }`, at least two. The id is what
  is stored and graded, and the label is what the pad shows, so rewording a label
  does not invalidate recorded attempts. Keep to **four** where you can: the pad
  holds four keys to a row on a phone, and answers 1 to 9 from the keyboard.
- **`perspective: "villain"`** means the two cards dealt are a holding the
  *opponent* could have, and the spot is spoken that way ("Their hand"). The
  generator does not filter villain-perspective hands through the hero's
  preflop line, because they are not the hero's.
- **Branches work as a predicate rule's do**, first match wins, and `default` is
  optional. Omit it and the rule abstains where no branch matches.
- **No `exceptions`, no `modifiers`, no action-valued override.** Each is refused
  at stage 3 (`ANSWER_KIND_MISMATCH`), not ignored. An "exception" to a closed
  list of answers is simply the first branch.
- **Board-relative strength is not a reading of the range.**
  `relative_strength_any` reads how the hand ranks against this board. A reading
  about how well a flop suits the opponent's *range* belongs on `hand_class_any`,
  `draw_class_any` and `villain_types`.
- **Arbitration keeps the kinds apart.** A label spot is governed only by label
  rules and an action spot only by action rules, however well a rule of the other
  kind fits. So a classify rule and an action rule over the same spots never
  compete. They are two different questions about one table.

### Count rule — the answer is a number the engine works out (2.0)

"Of these 24 combinations, 12 make top pair or better" is a question with one
right answer that the engine can compute. A count rule states the range, the
filter and what is dead; it states **no answer**:

```jsonc
{
  "kind": "count",
  "situation": { "street": ["flop"], "pot_type": ["three_bet"], "board_require": ["high"] },
  "range_set_id": "rs_reraiser",      // the opponent's range at this point in the hand
  "dead_cards": "board",               // "board" | "hero" | "none"
  "filter": { "kind": "hand_class_min", "hand_class": "top_pair_weak_kicker" },
  "prompt": "How many of these combinations make top pair or better?",
  "tolerance": 0                       // optional; 0, meaning exact, unless the page hedges
}
```

- **Filters:** `total` (every live combination), `hand_class_min` (this class *or
  better*, so `flush` includes full houses), `hand_class_any` (exactly these
  classes), `draw_class_any`, `bare_ace_of_suit` (holds the ace of that suit and
  no other card of it, such as a lone A♥ on a three-heart flop), `pocket_pairs`.
  **Omit `suit`** to mean the suit the board has three of, which is the only way
  to ask about a generated monotone flop, since it comes in any suit. The rule
  must then require `monotone` (`COUNT_SUIT_UNSTATED` otherwise).
- **The pad shows the range** (its `label`, then its hands), so a prompt need not
  restate it. Give the range set a `label` that says whose range it is and where
  it comes from ("The range he reraised with").
- **`dead_cards` says what is removed before counting.** Sources switch readings
  from one sentence to the next, and a guess here is wrong by a few combinations
  in a way no gate can see. So state it. `board` removes the community cards,
  `hero` removes those and the hero's two cards, and `none` counts preflop combos.
- **The situation reads no hand slot.** `hand_class_any`, `draw_class_any`,
  `draw_class_exclude` and `relative_strength_any` are refused
  (`ANSWER_KIND_MISMATCH`). The question is about the opponent's whole range, and
  scoping it to the hero's holding would generate spots whose answer does not
  depend on the thing being varied. For the same reason there are no exceptions
  or modifiers.
- **`tolerance` is the page's hedge, never the arithmetic's difficulty.**
  "Roughly 40" earns one and "12 of these" does not. A tolerance added because
  counting is hard hides which of the range and the counter is wrong, and that is
  the only thing this answer kind measures.
- **The grade has a direction.** A number under the range's gets `too_few`, one
  over gets `too_many`, and each has its own feedback key (§5). The reveal shows
  the answer with what it is out of ("12 of 24"), and a folded "How the 12 break
  down" lists the matching combinations by hand class.

---

## 4. The situation: the vocabulary, and the one discipline

`situation` is a **conjunction of per-slot memberships**: every field is an array
of allowed values, and the spot must satisfy all of them. There is exactly one
negation, `board_exclude` (and, since 1.7, `runout_exclude` / `draw_class_exclude`
— see below).

The slots, all optional, all closed vocabularies (the exact members are in the
schema `$defs`):

| Slot | Values |
|---|---|
| `street` | `preflop flop turn river` (single value or array) |
| `stakes` | `1/2 2/5 5/10` |
| `hero_position`, `villain_position` | `UTG UTG1 UTG2 LJ HJ CO BTN SB BB` |
| `pot_type` | `limped single_raised three_bet four_bet_plus` |
| `player_count` | `heads_up three_way multiway` |
| `stack_bracket` | `short standard deep very_deep` |
| `spr_bracket` | `very_low low medium high` |
| `preflop_facing_state` | `unopened facing_limp facing_raise facing_raise_and_call facing_3bet facing_4bet facing_steal` |
| `postflop_facing_state` | `first_to_act facing_check facing_bet facing_raise facing_donk` |
| `villain_raise_size` | `small standard large all_in` |
| `villain_types` | source-scoped `opponent_type` ids |
| `board_require` / `board_exclude` | board tags (below) |
| `hand_class_any` | `no_pair ace_high underpair weak_pair second_pair top_pair_weak_kicker top_pair_good_kicker overpair two_pair set straight flush full_house_plus` |
| `draw_class_any` / `draw_class_exclude` | `none backdoor_flush backdoor_straight gutshot open_ended flush_draw combo_draw` |
| `relative_strength_any` | `nuts strong medium weak` |
| `runout_any` / `runout_exclude` | `brick overcard pairs_board pairs_hero flush_completing flush_drawing four_flush straight_completing straight_completing_low straight_drawing four_straight` |
| `node_path` | ordered action steps (below) |

Board tags: structural (`paired trips monotone two_tone rainbow connected gapped
disconnected high middling low ace_high broadway_heavy straight_possible
flush_possible`) plus the static-to-dynamic texture scale (`static semi_static
dynamic two_wheel_cards`). **Texture is the flop's on every street** —
`board_require: ["dynamic"]` on a river rule means "the flop started dynamic".
`flush_complete` / `straight_complete` describe the five-card board and are
therefore unreachable texture tags.

### The discipline: an omitted slot claims EVERYTHING

> A slot you leave out is not "don't care from the reader's side" — it is **"this
> rule claims every value of it."**

A rule with no `hand_class_any` claims every hand on its board, including the ones
the passage never discussed. This is the mechanism behind every over-claim: the
rule's `situation` was wider than the passage.

**For the hand slots this is an ERROR, not a caution.** A postflop rule that
constrains none of `hand_class_any` / `draw_class_any` / `draw_class_exclude` /
`relative_strength_any`, and has no branch that reads one, fails stage 3
(`HAND_NEVER_EXAMINED`). It answers a set and seven-high with one action and one
reason — a reader who flopped a set was once told to raise for the reason a
bluff-catcher raises — and there is no reading under which "I did not look at the
hand" is the intended scope of a rule. Two choices, both legal: **narrow** to the
hands the passage discusses and let the rest abstain (the reader then never meets
a spot the source does not answer), or **write every class out**, which is the
source claiming the answer really is hand-independent (a passage that says to
check every hand from a blind against a particular opponent does exactly that).
Silence is not one of the choices.

Before writing a rule, answer the one question the whole gate is built around:

> **Which conditions does the source state before giving this advice?**

and put every one of them in `situation`. If you know a condition matters but write
it as a branch, the rule has already claimed the spot — the branch only chooses the
answer within what it claimed.

### `node_path` and actors (1.7)

The exact prior action sequence, as `<street>_<action>` steps, matched as an
ordered subsequence of what happened: `["hero_flop_bet", "villain_flop_call"]`. A
step may name who acted (`hero_` / `villain_`); an unprefixed step matches either.
This is what keeps an all-streets rule bounded, and what lets the spoken line read
"you bet the flop, they called" instead of "bet, call". The generator seats the
opponent from the facing state and the path (a bet you invited by checking first
came from *behind* you).

**A hero step on an earlier street is a claim your other rules have to support.**
`packages/drills/src/generator/lineFits.ts` rewinds each of them, arbitrates, and
requires the recorded action to be the answer your own flop or turn rules give
(or an `acceptable_alternatives` of it). So `["hero_flop_bet",
"villain_flop_call"]` on a turn rule only ever deals hands your flop rules would
have bet. If it deals nothing at all, the generator says `line-not-found`, and the
fix is on the earlier street: either that rule is wider than its passage, or this
line is not the one the passage describes. Nothing governing the rewound spot
imposes nothing — silence, as everywhere else.

**Do not end the path with the action being answered.** The facing state already
states it (`postflop_facing_state: facing_bet` *is* "they bet"). Both conventions
render identically — the hand history re-prices a trailing villain step that
matches the facing state and marks it pending rather than telling the bet twice —
but the shorter path is the one that says the same thing once.

### The "not" slots (1.7)

`draw_class_any` is any-of over a hand that can hold several draws at once, so it
cannot express "no real draw" — listing `none` and the backdoors admits a gutshot
that also backs into a flush. `draw_class_exclude` says it directly. Likewise
`runout_exclude` is for "as long as the turn does not …" — a `brick` means no other
tag fired, so "keep betting unless the turn completes a low straight" needs the
exclusion rather than "bet only on bricks", which would refuse the overcard the
page was happy to bet.

**A fourth flush or straight card is its own tag.** `four_flush` and
`four_straight` fire when the card takes the board to four (or five) of a suit,
or to four (or five) ranks inside one five-window. Neither could be said before:
a flush has been *possible* since the third card of a suit, so the fourth
completed nothing and drew to nothing, and `brick` — "no other tag fired" —
claimed the most dangerous card on the deck. If a rule excludes
`flush_completing` or `straight_completing` because the passage says the turn
did not improve the board, exclude the matching four-card tag with it.

**A scare card is a fill somebody plays, not a window.** `straight_completing`
fires only when the card creates the first completing two-rank holding with BOTH
ranks seven or higher — the T on K-J-5 (A-Q and Q-9 arrive) is a scare card; the
3 on A-8-5 (only 4-2 arrives) is not. The low-only fills carry
`straight_completing_low` instead; a rule whose premise is exactly that low card
names it, and a barrel rule that fires on bricks usually wants it in
`runout_any` alongside `brick` and `overcard`, because the wheel gutter is a
blank for the hands that call.

**A turn or river rule must take a runout stance.** Omitting both `runout_any`
and `runout_exclude` claims every card that can fall — the omitted-slot trap
wearing runout clothes; a rule that raises the turn can otherwise fire on the
flush-completing turns its own passage excludes. The `mece` gate refuses the
omission unless the rule is recorded in the runout-free allowlist (see §7 on
allowlists).

### Exceptions and modifiers

- **`exceptions`** are situations evaluated *before* the base rule, first match
  wins; use one for a genuine carve-out ("…except very deep, where the smaller
  size keeps the pot manageable"). Each is `{ "when", "then", "note" }`.
- **`modifiers`** substitute a range set or an outcome when a table condition holds
  (`game_texture`, `stack_bracket`). They *replace*, they do not transform. A
  modifier keyed on `game_texture` only fires when the reader has set the hub's
  "Game" facet.

---

## 5. Feedback: the source's voice, per reachable mistake

Feedback is a **lookup, not a generation** — this is what replaces a runtime model.
It is authored once per principle, keyed by error class, which is exactly why it
covers every scenario the generator will ever produce.

```jsonc
"feedback": {
  "correct":         "…",   // required
  "too_loose":       "…",   // called too wide / too many hands
  "too_tight":       "…",   // folded/gave up where the source continues
  "too_passive":     "…",   // checked/called where the source is aggressive
  "too_aggressive":  "…",   // bet/raised where the source is passive
  "wrong_sizing":    "…",   // right action, wrong bucket
  "right_idea_wrong_spot": "…"   // the reasoning fits a different branch
}
```

Which error keys are *reachable* is a function of the legal action set. Facing no
bet the legal set is `{check, bet}` so only `too_passive` / `too_aggressive` /
`wrong_sizing` can fire; facing a bet it is `{fold, call, raise}` so `too_loose` /
`too_tight` / `too_passive` / `too_aggressive` / `wrong_sizing` can. **Stage 6
requires `correct` plus every reachable error key** — a mistake the reader can
make with no sentence to meet it gets the engine's own filler under a line
admitting it is filler, which is exactly the trust leak §0 is about.

Write feedback **in the source's words**, citing the page. `rationale` is the
source's argument for the rule and *nothing else* — no encoder talk, no "the two
river rules then claimed the same board"; that reasoning belongs in the
encoding's own notes, never in front of the reader. Both are shown after every
reveal. (A licensed source's words reach the reader at runtime under its licence;
they are never written into this repository.)

**This is not a style note, and it is easy to fail without noticing.** A
paraphrase passes every gate: the `feedback` gate asks whether the key was
*authored*, not whether it quotes. An encoding can reach 100% on that gate with
most of its `correct` sentences written by the encoder. They are accurate, they
teach nothing, and they are what the reader sees every single time they are
right. The whole reason to drill a book rather than a solver is that the words
are the author's and the page is there to go back to. Audit your own source with:

```
node -e "const s=require(process.argv[1]); \
  s.principles.filter(p=>p.drillable!==false).forEach(p=>{ \
    const t=p.feedback.correct; if(t && !/[“”\"]|p\.?\s?\d/.test(t)) console.log(p.id, '|', t); })" \
  /path/to/your-encoding.json
```

### A rule with two right answers has two reasons (1.7)

One `correct` string cannot serve a rule that answers differently by side or
branch. A range rule that raises the list and folds the rest, with one `correct`
written for the raise, told a reader who *correctly folded* a weak hand on the
button that raising was right. So put the reason on the outcome:

```jsonc
"in_range":     { "action": "raise", "feedback": { "correct": "On the list, so it is raised." } },
"out_of_range": { "action": "fold",  "feedback": { "correct": "Off the list, so it is folded." } }
```

`outcome.feedback` is read *before* the principle's `feedback` (it can override any
key, not just `correct`); the principle's map answers everything the outcome does
not. **Stage 6 (`FEEDBACK_SIDE_AMBIGUOUS`, error) requires a `feedback.correct` on
every outcome of a rule whose outcomes differ in action** — every branch, the
default, `in_range`/`out_of_range`, and every exception. A rule with a single
action needs none of this.

### Labels and counts have their own mistakes (1.9, 2.0)

A label has one way to be wrong and no direction: `wrong_label`. "Scare card" is
not more aggressive than "blank", it is a different reading. A count has two,
and they point opposite ways: `too_few` (the reader missed combinations the
range has) and `too_many` (they counted some it cannot). Stage 6 asks for
`correct` plus `wrong_label` on every classify rule, and `correct` plus both
`too_few` and `too_many` on every count rule. Where one label deserves its own
sentence, put it on that outcome's `feedback`. It is read before the
principle's, exactly as on an action outcome.

---

## 6. Quiz hands: the source's own examples

Quiz hands are the **independent check** on the encoding. The classifiers decide
what every generated spot means; a refactor that re-tags a board silently changes
which principle fires, and the classifiers' own tests move with it. Quiz hands do
not: they are the source's stated answers to concrete spots, and the `sources`
gate re-runs them against the live encoding.

```jsonc
{
  "id": "qh_example_turn_raise",
  "source_id": "src_example_course",
  "page_ref": "88",
  "situation_instance": {
    "stakes": "1/2", "effective_stack_bb": 150,
    "hero_position": "CO", "hero_cards": ["Jh","Th"],
    "board": ["9c","8d","3s","2h"],
    "action_log": ["hero_preflop_raise","villain_preflop_call",
                   "villain_flop_check","hero_flop_bet","villain_flop_call","villain_turn_bet"],
    "villain_notes": "The big blind called the flop, then led small into the turn",
    "villain_type_id": "opp_weekend_regular",
    "villain_position": "BB",              // (1.7) where the text names the seat
    "pot_type": "single_raised", "player_count": "heads_up",
    "postflop_facing_state": "facing_bet", "villain_raise_size": "small"
  },
  "author_answer": { "action": "raise", "sizing": "large" }
}
```

The harness turns `situation_instance` into a scenario, finds the principle that
governs it, and compares the resolved outcome to `author_answer` on **action and
sizing** (`acceptable_alternatives` count as matches).

**The strictness rule — do not fight it:** an omitted coordinate means UNKNOWN, not
wildcard. A hand that does not state its `pot_type` will *not* match a principle
that constrains `pot_type`. This is deliberate and load-bearing: treating absence
as a match inflates the pass rate silently and makes the harness pick whichever
broad rule was declared first. So:

- Fill every coordinate the text actually states, transcribed from the page —
  positions, suits, villain type, player count, the action log verbatim.
- **Never** derive a coordinate from `author_answer` (that makes the hand match by
  construction), and never invent cards or a villain the passage does not give.
- Leave genuinely unstated coordinates absent.
- **A `situation_instance` coordinate is set only from what the passage states,
  never from what makes a principle match.** This is the same rule from both
  directions: `game_texture` (or any coordinate) added because it fires a
  modifier is annotating a hand to fit a rule — the mirror image of narrowing a
  rule to fit a hand — and it voids the hand as evidence. If the passage names
  the game as loose, transcribe it; if it does not, the modifier stays silent
  and that is the honest measurement.
- `action_log` uses the same step vocabulary as `node_path`, actors included.
- Bucket the sizing from the page's own amounts against `bet_size_brackets` — do
  not guess "medium" by feel.

**When the source gives no single answer**, set `indeterminate: true` with an
`indeterminate_reason` written from the text (the sentence in which the source
itself declines to choose), and omit `author_answer`. Indeterminate hands are
excluded from the pass rate. "No principle got it right" is a coverage hole
wearing a disguise, not an indeterminate hand — the reason has to be something
the passage itself says.

**Say where the hand came from (1.8).** `provenance: { kind, form }` on a quiz
hand records what the harness number can and cannot mean:

- `kind: worked_example` — the passage a rule was encoded from. It passes
  in-sample by construction and measures transcription, not fidelity; a corpus
  made only of these reads near 100% on matched hands for exactly that reason.
- `kind: probe` or `kind: held_out` — transcribed AFTER an encoding-freeze tag,
  from pages no drillable rule cites, with the situations closed. These are the
  only hands that measure fidelity. They are never used to fix a miss: a miss is
  the finding.
- `form: literal` — the source's own cards, board and line. `form: instantiated`
  — the passage named a hand class ("air", "a small pair") and the transcriber
  chose the cards. Not equal evidence: a mental model of the encoding leaks into
  chosen coordinates even with the rules closed.

The `sources` gate prints the out-of-sample rate on its own line with the
literal/instantiated split beside it and a Clopper–Pearson 95% interval beside
that, and never a blended figure alone. Omit `provenance` and the hand is read
as in-sample. It is never set from what a rule matches.

### When the source's answer is a label or a number (1.9, 2.0)

`author_answer` takes three shapes. An action has no `kind`, which is the shape
every hand had before labels existed. The other two are:

```jsonc
"author_answer": { "kind": "classify", "label": "hit_hard" }
"author_answer": { "kind": "count", "value": 12 }
"author_answer": { "kind": "count", "value": 40, "tolerance": 4 }   // the page said "roughly 40"
```

- **The kind of the answer picks the kind of rule** that may govern the hand. A
  label hand is checked against classify rules only, however well an action rule
  fits it.
- **A label must be one some classify rule in the source offers.** Stage 3
  refuses one that is not (`UNKNOWN_LABEL`); a typo would otherwise score as a
  silent fail against a rule that was right.
- **A count hand may leave out `hero_cards`**, because sources often ask counts
  with no hero hand in sight. It is scored when the governing rule's
  `dead_cards` is `board` or `none`, and reported **unusable** (not miscounted)
  when the rule removes the hero's cards, since nobody named them. Every hand
  coordinate of such a hand stays unstated.
- **A count's `tolerance` is the sentence's**, set from "about" or "roughly" and
  never from how close the encoding came. It is independent of the rule's own
  `tolerance`, which is what a reader is graded to.
- **Counts are in no rate.** A count pass shows that the range was transcribed
  right and the counter works. It shows nothing about whether the rules say what
  the source says, and with both right it is 100% by construction. So the
  `sources` gate prints `COUNTS REPRODUCED` on its own line, and keeps counts out
  of the raw rate, the decomposition rows and the perfect-score population. Label
  hands are in all three, like actions.
- **A discounted count is indeterminate.** A count the source adjusts by
  judgement (keeping only part of a hand because the opponent would have played
  the rest differently) is not arithmetic; mark it indeterminate and give the
  source's reason.

---

## 7. The gate loop

Eight gates read every encoding they are pointed at. In CI they read the invented
fixtures in `packages/drills/fixtures/`; locally, point them at a folder outside
the repository with `--dir` to gate a licensed encoding without committing it.
The loop is `sources` first (fidelity), then the other seven (what a *reader*
gets from the generator, which the source's worked examples say nothing about).

```
pnpm --filter @rivr/drills gates            # all eight, every fixture
pnpm --filter @rivr/drills gates sources    # worked examples reproduce; 100% on ≥20 hands FAILS (raw OR matched)
pnpm --filter @rivr/drills gates generator  # every principle produces spots; every story is tellable; none governed by a disagreeing rule
pnpm --filter @rivr/drills gates lines      # every chips-in step of a governing example's line is pinned by the rule
pnpm --filter @rivr/drills gates winnable   # every spot is answerable in words the pad offers
pnpm --filter @rivr/drills gates overclaim  # no rule gives up on a hand its situation never examined
pnpm --filter @rivr/drills gates feedback   # every reachable mistake has the source's own sentence
pnpm --filter @rivr/drills gates variety    # every principle can ask ≥ 250 distinct questions (calibrated floor)
pnpm --filter @rivr/drills gates mece       # no two rules disagree in a shared region without an allowlist entry
```

Flags: `--dir <folder>` reads every `*.json` in another folder; `--source <file |
source.id>` narrows a run to one encoding while you iterate (CI never narrows);
`--report <folder>` also writes the reports below. A log prints one
`=== <file> (<id>) ===` section per encoding and a final `N encoding(s) × M
gate(s), K failed` line.

poker-settle also had a deep sweep (10,000 generated quizzes, ten checks each)
outside CI. It is not ported; the gates above are the CI contract.

**`lines` is the one that catches an under-scoped `node_path`.** The fidelity
gate compares the *answer* on the source's hands, and an empty `node_path`
matches every hand vacuously — so a turn rule encoded from a passage about "you
bet the flop and were called" passes it with no path at all, and the generator,
which replays only the path, deals the same spot after a flop that was checked
through. This asks the other question: every chips-in step the hand's
`action_log` records on a street *before* the decision must be required by the
rule's path, and the hero's preflop action must be the one the spot will infer
(which is the range the hole cards are dealt from).

**Allowlists.** `lines`, `mece` and `overclaim` each take an allowlist of
adjudicated findings, keyed by `source.id`, in
`packages/drills/scripts/gates/allowlists.ts`. They are empty, and must stay
empty of licensed sources: an entry's reason cites its source, and citations of a
licensed source do not belong in a public repository (`docs/decisions/0016`). A
key that names no encoding in the run fails at any state.

With `--report <folder>`, `sources` writes two reports per encoding:

- **`<source>.scope-gaps.md`** — the re-encoding work list. Per principle, worst
  first: the references its examples came from, the scope it already enforces,
  and the conditions it demoted to branches (which is usually why it
  over-claims). Work this file top to bottom.
- **`<source>.decomposition.json`** — the full per-hand breakdown behind the
  headline numbers, including the untested-principle share and the specificity
  distribution of governing principles. **Specificity creep is the earlier
  signal of fitting** — it rises before generativity collapses — so watch the
  median across runs.

`variety` writes the third, **`<source>.variety.json`**: the floor, the
distribution of distinct questions per principle, and the per-principle counts. A
median that collapses between runs means the file is being fitted even if
nothing crosses the floor.

### What variety can and cannot catch

The floor of 250 was calibrated in poker-settle against a recorded fit and its
honest revert:

- **The fitted encoding cleared the original floor of 50 nearly fourfold.** The
  guard would not have caught the failure it was built for. The floor is now 250,
  between the two encodings' minima.
- The two distributions differed in **exactly one principle**, because
  reader-visible variety is **card-dominated**: a situation can collapse from six
  constrained coordinates to eleven and still deal hundreds of distinct card
  combinations.
- Therefore variety detects only the **thinning** class of fit. Narrowing on
  non-card coordinates until each quiz hand has one candidate is invisible to it.
- **The discriminating guards are the perfect-score trip and the
  governing-specificity distribution** in `sources`. Variety is a secondary
  check, and **a green variety run is not evidence that an encoding has not been
  fitted.**

The console output already tells you the two moves that fix most failures:
**promote a demoted condition** into `situation`, or **drop a default so the rule
abstains**. A failing hand means the encoding or the fixture is wrong — fix it
against the page, never by loosening the matcher or lowering the threshold.

### `THIN_ENCODING` — honest vs. worth fixing

Stage 6 warns when a principle can generate very few distinct spots (its situation
is pinned so tightly that the drill will repeat). Sometimes that is honest — a
rule the source states for one narrow game with one worked hand genuinely has
little room, and the warning is just describing the source. Widen it only if the
passage supports a wider claim; do not loosen a situation to silence the warning,
because that reintroduces exactly the over-claim §0 forbids.

---

## 8. Definition of done

A source is ready to flip to `state: "active"` when:

1. All eight gates pass. `sources` clears `quiz_pass_threshold` — and is NOT at
   100% on either metric. A perfect raw pass rate (≥ 20 scored hands) or perfect
   accuracy-on-matched (≥ 20 matched hands) fails the build at any state: against
   a prose source whose worked examples lean on reads, table history and prior
   action no coordinate captures, perfect fidelity is not achievable, so 100%
   means the encoding was narrowed to fit the hands — or the hands are in-sample.
   The band to land in is [`quiz_pass_threshold`, 100%).
2. The untested-principle share is low enough to mean something. The gate prints
   it beside the pass rate; a pass rate earned while a third of the drillable
   principles are exercised by no hand verifies only the tested third.
3. Every remaining `default` is traceable to a sentence in its passage; every
   over-claimer either narrowed or made to abstain. `overclaim` reports zero
   absurd answers.
4. Every reachable mistake has the source's own words; every two-answer rule has
   per-outcome `correct`.
5. Every quiz hand is transcribed from the page, indeterminate ones justified from
   the text.
6. Its `source.id` is its own — the app keys FSRS schedules and attempt history by
   it, so two sources sharing an id would merge their progress.
7. The variety floor (250) is the same for every source — it was calibrated
   against a fit, not against a book — and is not re-calibrated per source.

Then set `state: "active"`, and the gates protect it from that point on: a red
run means a source a reader is actually graded by has stopped reproducing its own
author's answers.

---

## 9. Extending the ontology

Only if the source genuinely says something the vocabulary cannot. Extensions are
**additive only** and bump `ontology_version`, so every earlier encoding stays
valid. The cost of a new `situation` field is a coordinate some reader forgets to
read, so wire it everywhere a coordinate is read (matcher, ranker, generator,
slots, validator, harness, analytics, the spoken description) before relying on
it, and add the enum to both the schema and the `as const` tuple in
`packages/drills/src/ontology/vocabulary.ts` — the conformance test fails the
instant they drift.
