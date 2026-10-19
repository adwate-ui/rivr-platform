# 0061 The DataTable @perf check runs with the visual tests

Date: 20 Oct 2026. Task: #30.

- #30 asks for an @perf test that a DataTable past 200 rows stays smooth. No console screen holds hundreds of rows yet, and the seed has a few dozen members, so no e2e flow can reach one.
- The check runs in a real browser against the built Storybook's ManyRows story: 10,000 rows. It is `packages/ui/visual/perf.spec.ts`, tagged `@perf`, and runs in the Playwright container with the visual tests. It checks that the table is drawn within 3 s, that fewer than 40 rows are in the page, and that the last row is reached by scrolling.
- The e2e job doesn't build Storybook, so `pnpm e2e --grep @perf` doesn't run this check. It runs with `pnpm visual` and in CI's verify job.
- When a console screen first lists hundreds of rows (members, reports), its flow adds an e2e @perf case against that screen.
