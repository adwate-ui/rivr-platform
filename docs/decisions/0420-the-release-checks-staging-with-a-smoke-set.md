# 0420: The release checks staging with the flows tagged @staging

Date: 3 Nov 2026. The owner, for the first production release: "Yes: flows tagged @staging gate the release; the full suite keeps running in CI on every PR and on main."

- **Why.** release.yml ran every end-to-end flow against staging, which no release had tried. Nine flows read the database through `docker exec … psql` on a local stack the release runner doesn't have, two take the local service-role key, and others expect the seed as it stands after a reset. A tag would have failed at `e2e-staging`, so nothing would reach production.
- **The set.** A flow is tagged `@staging` (`{ tag: '@staging' }` on its `describe` or test) when it uses only the apps and signs in, if at all, with one of staging's test numbers: smoke (every surface starts), sign-in, console sign-in, the PWA, and the website's shipped pages. A test in a tagged group that needs a number staging doesn't list skips itself there, as console sign-in's not-staff test already does. The front page's live stakes read staging's own tables, so that test is left out.
- **Proof.** Rehearsed from WSL against staging on 3 Nov, as the job runs it: 21 passed, 2 skipped.
- **Unchanged.** CI runs every flow, in its shards, against the local stack on every pull request and on main. The release still needs CI's full run green at the tagged commit.
- **Still reads staging's data.** Identity › Start needs member 202 without a finished identity check, and the club's pages need the seed's Buy-in bonus Tuesday and Hold'em article published. Completing KYC as 202 or unpublishing either on staging stops the release until it is put back.
- **Adding to it.** Tag a new flow only once it passes against staging without touching its database; staging's seed numbers are in its Auth settings as test numbers.
