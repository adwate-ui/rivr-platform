/**
 * The end-to-end flows (e2e/flows/): the linked flows in the design prompt and the additions, each
 * across the apps it touches, against the seeded local stack. `pnpm e2e` builds the apps (cached)
 * and serves each on this worktree's ports; the release workflow sets RIVR_E2E_TARGET=staging and
 * the E2E_<APP>_URL variables to run the same flows against staging.
 */
import { defineConfig, devices } from '@playwright/test';
import { appPort } from '@rivr/config/worktree';
import { APPS, isRemoteTarget } from './e2e/support/apps.ts';

export default defineConfig({
  testDir: 'e2e/flows',
  // A flaky test is a bug (.claude/rules/testing.md): fix it, never retry it into green.
  retries: 0,
  // Flows share the seeded database, so they run one at a time.
  workers: 1,
  reporter: isRemoteTarget() ? [['list']] : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  // Against staging nothing is kept: a trace or screenshot would hold staging sessions, and
  // this repository and its workflow artifacts are public.
  use: isRemoteTarget()
    ? { trace: 'off', screenshot: 'off' }
    : { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: isRemoteTarget()
    ? []
    : APPS.map((app) => ({
        command: `pnpm --filter ${app} preview`,
        port: appPort(app),
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      })),
});
