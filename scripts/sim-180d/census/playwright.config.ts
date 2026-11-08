/**
 * The screen census, against the simulation's stack (block 557), with each app served by its own preview server from
 * the harness worktree. One project per app and size (design 3b); `CENSUS_SIZES=first` keeps the first size of each.
 * It runs by hand through `pnpm census`, never in CI.
 */
import { join } from 'node:path';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { appPort } from '@rivr/config/worktree';
import { APPS } from '../../../e2e/support/apps.ts';
import { REPO_ROOT } from '../src/paths.ts';

type Projects = NonNullable<PlaywrightTestConfig['projects']>;

const everySize = process.env['CENSUS_SIZES'] !== 'first';
const out = process.env['CENSUS_OUT'] ?? 'test-results';
const club = { timezoneId: 'Asia/Kolkata', locale: 'en-IN' };
const phone = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } };

/** [name, spec, how it is shown, first size of its app] */
const SIZES: readonly [string, string, Record<string, unknown>, boolean][] = [
  ['player-390', 'player', phone, true],
  // The iPhone preset only names WebKit as its default; the project must ask for it.
  ['player-390-webkit', 'player', { ...devices['iPhone 13'], browserName: 'webkit', viewport: { width: 390, height: 844 } }, false],
  ['player-1440', 'player', { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, false],
  ['console-1440', 'console', { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, true],
  ['console-1280', 'console', { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }, false],
  ['tablet-1180', 'tablet', { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, hasTouch: true }, true],
  ['door-1180', 'door', { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, hasTouch: true }, true],
  ['display-1920', 'display', { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } }, true],
  ['web-390', 'web', phone, true],
  ['web-1440', 'web', { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, false],
];

const projects: Projects = [
  { name: 'sessions', testMatch: /sessions\.setup\.ts/, use: { ...devices['Desktop Chrome'], ...club } },
  { name: 'devices', testMatch: /devices\.setup\.ts/, dependencies: ['sessions'], use: { ...devices['Desktop Chrome'], ...club } },
  ...SIZES.filter(([, , , first]) => everySize || first).map(([name, spec, use]) => ({
    name,
    testMatch: new RegExp(`${spec}\\.census\\.ts`),
    dependencies: ['devices'],
    use: { ...use, ...club },
  })),
  { name: 'sheets', testMatch: /sheets\.census\.ts/, dependencies: ['devices'], use: { ...devices['Desktop Chrome'], ...club } },
  { name: 'states', testMatch: /states\.census\.ts/, dependencies: ['devices'], use: { ...devices['Desktop Chrome'], ...club } },
];

export default defineConfig({
  testDir: '.',
  retries: 0,
  workers: Number(process.env['CENSUS_WORKERS'] ?? '10'),
  fullyParallel: true,
  timeout: 90_000,
  reporter: [['list'], ['json', { outputFile: join(out, 'results.json') }]],
  outputDir: out,
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects,
  webServer: APPS.map((app) => ({
    command: `pnpm --filter ${app} preview`,
    cwd: REPO_ROOT,
    url: `http://127.0.0.1:${String(appPort(app))}`,
    reuseExistingServer: true,
    timeout: 120_000,
  })),
});
