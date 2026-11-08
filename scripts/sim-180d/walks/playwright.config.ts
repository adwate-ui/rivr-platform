/**
 * The walks: every e2e flow, unchanged, and the harness's own walks for workflows no flow covers, on a checkpoint night
 * of the simulation (block 557), with the browser on the simulation's clock (walks/clocked.ts). One at a time, as the
 * flows share the database. Run by hand through `pnpm walks`, never in CI.
 */
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { appPort } from '@rivr/config/worktree';
import { APPS } from '../../../e2e/support/apps.ts';
import { REPO_ROOT } from '../src/paths.ts';

const out = process.env['WALKS_OUT'] ?? 'test-results';
const player = `http://127.0.0.1:${String(appPort('player'))}`;
const browser = {
  ...devices['Desktop Chrome'],
  timezoneId: 'Asia/Kolkata',
  permissions: ['camera'],
  storageState: { cookies: [], origins: [{ origin: player, localStorage: [{ name: 'rivr.cookies', value: JSON.stringify({ maps: false, analytics: false }) }] }] },
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
};

export default defineConfig({
  retries: 0,
  workers: 1,
  timeout: 180_000,
  reporter: [['list'], ['json', { outputFile: join(out, 'results.json') }]],
  outputDir: out,
  use: { trace: 'on', screenshot: 'on' },
  projects: [
    { name: 'flows', testDir: join(REPO_ROOT, 'e2e', 'flows'), use: browser },
    { name: 'walks', testDir: '.', testMatch: /\.walk\.ts$/, use: browser },
  ],
  webServer: APPS.map((app) => ({
    command: `pnpm --filter ${app} preview`,
    cwd: REPO_ROOT,
    url: `http://127.0.0.1:${String(appPort(app))}`,
    reuseExistingServer: true,
    timeout: 120_000,
  })),
});
