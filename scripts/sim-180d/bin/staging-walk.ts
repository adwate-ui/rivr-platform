/**
 * `STAGING_TEST_OTP=… SIM_STAFF_NUMBER=… SIM_MEMBER_NUMBER=… SIM_ERASE_NUMBERS=… pnpm staging:walk`: the staging
 * journeys. Refuses unless the preflight passes (the owner's number alone on WHATSAPP_ALLOWLIST). Staging's app
 * URLs come from the repository's variables; the sign-in code only from the environment, never a file.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { z } from 'zod';
import { say } from '../src/log.ts';
import { SIM_HOME } from '../src/paths.ts';

const HERE = new URL('.', import.meta.url).pathname;
const code = process.env['STAGING_TEST_OTP'] ?? '';
if (code === '') throw new Error('STAGING_TEST_OTP is not set');

const preflight = spawnSync('pnpm', ['-s', 'staging:preflight'], { cwd: join(HERE, '..'), stdio: 'inherit', env: process.env });
if (preflight.status !== 0) {
  say('the preflight failed: the staging walk waits');
  process.exit(1);
}

const variables = z.array(z.object({ name: z.string(), value: z.string() }))
  .parse(JSON.parse(execFileSync('gh', ['variable', 'list', '--repo', 'adwate-ui/rivr-platform', '--json', 'name,value'], { encoding: 'utf8' })));
const url = (app: string): string => variables.find((each) => each.name === `STAGING_${app}_URL`)?.value ?? '';
const out = join(SIM_HOME, 'staging', new Date().toISOString().slice(0, 16).replaceAll(/[-:T]/g, ''));
const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '-c', 'staging/playwright.config.ts'], {
  cwd: join(HERE, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    RIVR_E2E_TARGET: 'staging',
    E2E_SIGN_IN_CODE: code,
    E2E_PLAYER_URL: url('PLAYER'),
    E2E_CONSOLE_URL: url('CONSOLE'),
    E2E_TABLET_URL: url('TABLET'),
    E2E_DISPLAY_URL: url('DISPLAY'),
    E2E_WEB_URL: url('WEB'),
    SIM_SUPER_NUMBER: process.env['SIM_SUPER_NUMBER'] ?? '9000000101',
    STAGING_OUT: out,
    STAGING_WALK: process.argv.includes('--owner') ? 'owner' : 'journeys',
  },
});
say(`staging walk: playwright exited ${String(result.status)}; output in ${out}`);
