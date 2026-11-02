/**
 * The end-to-end flows (e2e/flows/): the linked flows in the design prompt and the additions, each
 * across the apps it touches, against the seeded local stack. `pnpm e2e` builds the apps (cached)
 * and serves each on this worktree's ports; the release workflow sets RIVR_E2E_TARGET=staging and
 * the E2E_<APP>_URL variables to run the same flows against staging.
 */
import { defineConfig, devices } from '@playwright/test';
import { appPort } from '@rivr/config/worktree';
import { APPS, isRemoteTarget } from './e2e/support/apps.ts';

// The player app's origin, where a phone has already answered the cookie banner (decision 0298), so the banner covers no
// flow's buttons; its own tests are in @rivr/ui and the app. Staging's comes from the release workflow.
const playerUrl = isRemoteTarget() ? process.env['E2E_PLAYER_URL'] : `http://127.0.0.1:${appPort('player')}`;
const cookiesAnswered = playerUrl === undefined ? undefined : {
  cookies: [],
  origins: [{ origin: new URL(playerUrl).origin, localStorage: [{ name: 'rivr.cookies', value: JSON.stringify({ maps: false, analytics: false }) }] }],
};

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
  // A camera the browser fakes and the person has allowed: KYC photos are taken with the live camera, never a file (K-07).
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      permissions: ['camera'],
      ...(cookiesAnswered ? { storageState: cookiesAnswered } : {}),
      launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    },
  }],
  webServer: isRemoteTarget()
    ? []
    : APPS.map((app) => ({
        command: `pnpm --filter ${app} preview`,
        // Wait for the exact address the tests open: a port check passes on IPv6 localhost
        // while 127.0.0.1 still refuses, which is what failed on GitHub's runners.
        url: `http://127.0.0.1:${appPort(app)}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      })),
});
