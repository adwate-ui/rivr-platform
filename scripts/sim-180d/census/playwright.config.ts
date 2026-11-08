/**
 * The screen census and the clock spike: against the simulation's stack (block 557), with the apps served by
 * `pnpm --filter <app> preview` from the harness worktree. The census runs by hand, never in CI.
 */
import { defineConfig, devices } from '@playwright/test';
import { appPort } from '@rivr/config/worktree';

const playerOrigin = `http://127.0.0.1:${appPort('player')}`;

export default defineConfig({
  testDir: '.',
  retries: 0,
  // The census reads one snapshot; walks that change it run elsewhere, one at a time.
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // A phone that has answered the cookie banner already (decision 0298), as in the e2e flows.
        storageState: {
          cookies: [],
          origins: [{ origin: playerOrigin, localStorage: [{ name: 'rivr.cookies', value: JSON.stringify({ maps: false, analytics: false }) }] }],
        },
      },
    },
  ],
});
