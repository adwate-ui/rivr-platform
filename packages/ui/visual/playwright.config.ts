import { defineConfig } from '@playwright/test';

/**
 * Visual tests: one screenshot per Storybook story, compared with the committed baselines in
 * visual/baselines/. They run only inside the official Playwright container (visual/run.mjs),
 * so local and CI screenshots come from the same browser, fonts and libraries (docs/decisions/0009).
 */
export default defineConfig({
  testDir: '.',
  // The screenshots, and the @perf checks that need a real browser (perf.spec.ts).
  testMatch: ['stories.spec.ts', 'perf.spec.ts'],
  outputDir: './test-results',
  snapshotPathTemplate: '{testDir}/baselines/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  // A missing baseline is a failure; only `pnpm visual -- --update` writes baselines.
  updateSnapshots: 'none',
  reporter: [['list', { printSteps: false }]],
  expect: {
    toHaveScreenshot: { maxDiffPixels: 0, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  use: {
    browserName: 'chromium',
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
});
