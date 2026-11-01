# 0288: Query keys, one place for each entry point

Date: 1 Nov 2026. The audit of 28 Oct, D15: F4-18.

- **The finding.** Twelve `@rivr/db` modules keep their TanStack Query keys beside them instead of in `queryKeys.ts`, which reads as two ways of doing one thing (rule 6).
- **Why they do.** Each is a subpath of its own (`@rivr/db/hostQueue`, `/siteEditor`, `/reports` and so on), and each says so: "kept here, not in queryKeys". `queryKeys` is one object, which a bundler cannot trim, so every key in it rides in the player's first load. Keys a console screen or a subpath alone reads would only add to it.
- **The rule, so it is one way.** The main entry's reads keep their keys in `queryKeys.ts`; Purge's three, which `practiceReset.ts` kept beside it though it is no subpath, moved there. A module that is its own subpath keeps its keys beside it, with that line saying so. Every key still starts with the user id. `queryKeys.ts`'s header now says this.
- **Prefix helpers.** An invalidation of a family of keys names it through `queryKeys` (`memberSearchAll`, `membersOfTierAll`, `currentDownAll`), never by a hand-written array, so renaming a key cannot quietly stop it. The hand queue's and Learn's, behind features that are off, wait with them.
- **The two queues' classifiers** (the finding's second half): the tablet's hand queue parks an unknown error and Learn's retries it. Both queues are off now, hand entry and Learn with decision 0284, so they wait for whichever comes back first.
