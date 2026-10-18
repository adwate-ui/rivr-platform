# 0009 Visual tests run in the Playwright container

Date: 18 Oct 2026

`pnpm visual` screenshots every Storybook story and compares it with a committed baseline. Font rasterisation and anti-aliasing differ between machines, so a screenshot taken in WSL would not match one taken on a GitHub-hosted runner, and a pixel threshold loose enough to hide that also hides real changes.

Decision: `packages/ui/visual/run.mjs` runs Playwright inside `mcr.microsoft.com/playwright:v1.64.1-noble` (the version pinned in `package.json`) with `docker run`, the repository mounted at the same path and the developer's user id. The suite (`visual/stories.spec.ts`) reads the built Storybook's `index.json`, serves `storybook-static/` to the browser from disk, and compares with `maxDiffPixels: 0`. Shell stories carry a `viewport-phone|tablet|console|tv` tag and are shot at 390×844, 1180×820, 1440×900 and 1920×1080; components at 960×640, full page. Baselines live in `packages/ui/visual/baselines/`; `pnpm visual -- --update` rewrites changed and missing ones and deletes orphans.

Consequences: Docker is required for visual tests, locally and in CI (both have it, `docs/decisions/0001`). Upgrading `@playwright/test` means changing the image tag in `run.mjs` and regenerating every baseline in one PR. The `@rivr/render` baseline test runs on the host instead and allows 0.1% of pixels to differ.
