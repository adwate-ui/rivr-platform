# 0586. The Academy and Learn removed

From the redesign brief of 15 Nov (#947). One generated migration drops the Academy's batches, bookings, payments, attendance and graduation, Learn's sessions, lessons and licensed sources, their 51 functions, settings, features and permission, and the venue's SAC code for the Academy (the owner, 15 Nov). `packages/drills` and `docs/spec/learn` go with them.

- **The Academy graduate tier is retired, not deleted.** No member holds it (each became a Member, with a line in their tier history), a new venue is made without it, and nothing offers it. Its row stays at a venue that had one, because members' tier history names it (the owner, 15 Nov: retire it, keep the history).
- **Money already recorded stays.** Tax invoices issued in the Academy's series and the ledger's entries for its fees are not touched. The series has no SAC code now, so nothing more is invoiced in it; a series that never issued an invoice is deleted.
- **A graduate promotion that ever gave something stops the migration.** The two graduate templates and the promotions made from them are deleted where they never gave anything. Production and staging have none that did.
- **The promotion engine keeps its `graduation` trigger.** Nothing fires it now. Taking it out changes the rule engine's schema and golden cases, which the issue does not ask for.
- **The website:** the Academy's page is deleted at every venue, with any link that handed a visitor to the Academy in the app. `PLAYER_DESTINATIONS` has no `academy`.
- **Ad conversions:** an Academy booking is no longer a conversion. Google Ads' saved actions are read less any key that is no kind, so a value saved before still reads.
- **The `learn-sources` storage bucket stays**, private and with its policies gone: no one but the service role reads it. It is empty on production and staging.
- **Activity keeps its words for the Academy and Learn** (`Academy booking`, `Learn source`), and the audit's list of shareable entities keeps `academy_batch`, so a line from before 15 Nov still reads in words (as decision 0585 did for points).
- **Saved versions of website pages are not rewritten.** Restoring one that pointed to the Academy would bring a link the website cannot read. Neither production nor staging has such a version (read 15 Nov).
- **A paid booking stops the migration**, as a graduate promotion that gave something does: its bank reference and its record of who bought which seat would go with the table. Neither database has one.
- **CI's `drills` job is removed** with the engine it ran (the owner, 15 Nov), and `scripts/verify.mjs` has no drills part.
- **Tests of tier gates** used Learn as their example feature. They use Events now, which also starts off.
