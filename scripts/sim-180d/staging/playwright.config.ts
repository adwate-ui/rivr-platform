/**
 * The staging walks (design 3d): staging's own apps, Chromium (Edge's engine) with a fake camera, one at a time.
 * `pnpm staging:walk` sets RIVR_E2E_TARGET=staging, the E2E_<APP>_URL variables and E2E_SIGN_IN_CODE from the
 * environment; nothing here holds a URL secret or a code. Run by hand only, after the preflight passes.
 */
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const out = process.env['STAGING_OUT'] ?? 'test-results';
const player = process.env['E2E_PLAYER_URL'] ?? 'https://invalid.example';

export default defineConfig({
  testDir: '.',
  // journeys.walk.ts, or the owner's own walk with STAGING_WALK=owner.
  testMatch: new RegExp(`${process.env['STAGING_WALK'] ?? 'journeys'}\\.walk\\.ts$`),
  retries: 0,
  workers: 1,
  timeout: 600_000,
  reporter: [['list'], ['json', { outputFile: join(out, 'results.json') }]],
  outputDir: out,
  use: {
    ...devices['Desktop Chrome'],
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    permissions: ['camera'],
    trace: 'on',
    screenshot: 'on',
    storageState: { cookies: [], origins: [{ origin: new URL(player).origin, localStorage: [{ name: 'rivr.cookies', value: JSON.stringify({ maps: false, analytics: false }) }] }] },
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
});
