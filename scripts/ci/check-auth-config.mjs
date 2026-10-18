#!/usr/bin/env node
/**
 * Checks a project's Auth settings once its migrations are in (#187, runbook "Auth and API").
 * While phone sign-in is on, a session must come only from a code: the access-token hook on,
 * calling private.require_code_sign_in; phone confirmations on; the email provider off.
 * Test sign-in numbers sign in with a fixed code (#229): production has none, whether phone sign-in
 * is on or not, and staging only the seed's (supabase/seed/10_people.sql).
 * `--warn` is staging: a gap is a warning. Otherwise it is production, and a gap fails the release.
 * Needs SUPABASE_ACCESS_TOKEN and PROJECT_REF.
 */
import { readFileSync } from 'node:fs';

const HOOK_URI = 'pg-functions://postgres/private/require_code_sign_in';

const REQUIRED = [
  ['hook_custom_access_token_enabled', true, 'the Customize Access Token hook is on'],
  ['hook_custom_access_token_uri', HOOK_URI, `the hook calls ${HOOK_URI}`],
  ['sms_autoconfirm', false, 'phone confirmations are on ("Confirm phone")'],
  ['external_email_enabled', false, 'the email provider is off'],
];

const staging = process.argv.includes('--warn');
const { SUPABASE_ACCESS_TOKEN: token, PROJECT_REF: ref } = process.env;
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and PROJECT_REF are required');

const reply = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { headers: { authorization: `Bearer ${token}` } });
if (!reply.ok) throw new Error(`Reading the Auth settings failed: HTTP ${reply.status}`);
const auth = await reply.json();

/** The numbers in `sms_test_otp` ("919000000101=123456,…"), without the codes, which are never printed. */
function testNumbers(setting) {
  // A missing or renamed field must not read as "no test numbers" and wave a release through.
  if (setting !== null && typeof setting !== 'string') throw new Error('Unexpected Auth settings: sms_test_otp is missing');
  return (setting ?? '').split(',').map((entry) => entry.split('=')[0].trim()).filter((number) => number !== '');
}

/** The seed's phone numbers, as Auth writes them: digits only, no plus sign. */
function seedNumbers() {
  const seed = readFileSync(new URL('../../supabase/seed/10_people.sql', import.meta.url), 'utf8');
  return new Set([...seed.matchAll(/'\+(\d{10,15})'/g)].map((match) => match[1]));
}

const seeded = seedNumbers();
const unexpected = testNumbers(auth.sms_test_otp).filter((number) => !staging || !seeded.has(number));
const gaps = unexpected.map((number) => `test sign-in number ${number} is listed (${staging ? 'not a seed number' : 'production has none'})`);

// A missing or renamed field must not read as "phone sign-in off" and wave a release through.
if (typeof auth.external_phone_enabled !== 'boolean') throw new Error('Unexpected Auth settings: external_phone_enabled is missing');
if (auth.external_phone_enabled !== true) {
  process.stdout.write('::notice::Phone sign-in is off on this project, so the code-only settings are not required yet.\n');
} else {
  gaps.push(...REQUIRED.filter(([field, expected]) => auth[field] !== expected).map(([, , rule]) => `not yet: ${rule}`));
}
for (const gap of gaps) {
  process.stdout.write(`::${staging ? 'warning' : 'error'}::Auth settings: ${gap}. See docs/runbooks/ci-and-release.md.\n`);
}
if (gaps.length === 0) process.stdout.write('Auth settings: sessions come only from a code, and no unexpected test number is listed.\n');
process.exit(gaps.length > 0 && !staging ? 1 : 0);
