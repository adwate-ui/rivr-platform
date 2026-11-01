# 0289: The UI polish audit and the owner's answers

Date: 2 Nov 2026. Report: `docs/design/ui-polish-audit.md`. Work in six batches (B1 to B6), tracked in the UI Polish Tracker.

- **The audit:** a live walkthrough of every app, KYC on Cashfree's sandbox, a static audit of `@rivr/ui` and the copy, and an asset review.
- **Hidden features lead to Tonight.** A screen hidden for the member's tier (Learn, Events, and Academy through Learn) sends its address to Tonight. It never shows an empty screen, as decision 0284 meant.
- **Copy:** the owner found the app's copy over-explained ("reads like AI slop"). Batch B3 tightens the voice in `.claude/rules/copy.md`:
  - the fact, then stop;
  - labels of one to three words;
  - status lines of eight words or fewer;
  - errors in one sentence ending in what to do;
  - no intro or hint under a heading unless a field cannot be filled without it.
- **The owner's answers:**
  - **Table art.** Use licensed assets from online. No free, real, top-down table photo exists, so the seat map's table is drawn in `@rivr/ui` from the tokens. A paid overhead photo stays the owner's option.
  - **Placeholders until the club's own shoot.** Licensed stock photos (Pexels and Unsplash licences) stand in, marked as placeholders. This suspends `ui.md`'s "never stock" for the website until the shoot. The website's placeholder phone number stays until the owner gives the real one.
  - **League points** are added by hand or by CSV.
  - **Type:** keep the investor deck's faces, with Bodoni Moda's optical sizes and a matching ₹. Licensed faces only with the brand's designer.
- **KYC under review:** the app stays locked to the review screen (identity rule, safest reading). Whether a member may read Tonight while under review goes to the owner as a question.
- **KYC locally:** Cashfree refuses a DigiLocker `redirect_url` that is not https.
  - To run it on a local stack, put the sandbox keys in the gitignored `supabase/functions/.env` and set `PLAYER_APP_URL=https://127.0.0.1:<player port>`.
  - In the browser, map that address back to http, as the audit's Playwright run did.
  - Never commit the keys.
- **Narrower than the audit asked, on purpose:**
  - E-14: the rail keeps its pinned foot (sign-out stays in view, `ConsoleShell.test`). A hairline above the foot and the item it cuts off are the cue that the list goes on; no fade, as the visual standard has no gradients.
  - K-05: `lang="en-IN"` is the right language tag for every app, but a date field's order follows the browser's own locale, so it does not change mm/dd/yyyy on a phone set to US English.
  - K-04 moved out: the functions do not log to the console (`no-console`, a project rule), so a vendor refusal's trace belongs with the vendor-call row in the database, a schema change of its own (follow-up issue).
- **Findings corrected on reading the code:**
  - E-03 and E-09 were the local stack answering within the 80 ms between taps; busy states hold on a real network.
  - E-05: a revoked tablet leaves at its next 30-second check.
  - E-13: an empty number never leaves the field.
  - E-10: Leave's refusals are reported; only its busy state was missing.
