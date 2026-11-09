#!/usr/bin/env node
/**
 * Checks a project's Auth settings once its migrations are in (#187, runbook "Auth and API").
 * While phone sign-in is on, a session must come only from a code: the access-token hook on,
 * calling private.require_code_sign_in; phone confirmations on; the email provider off.
 * Test sign-in numbers sign in with a fixed code (#229): production has none but the app stores' reviewer's
 * (STORE_REVIEWER_NUMBER, decision 0575), whether phone sign-in is on or not, and staging only the seed's (supabase/seed/).
 * `--warn` is staging: a gap is a warning. Otherwise it is production, and a gap fails the release.
 * Needs SUPABASE_ACCESS_TOKEN and PROJECT_REF.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { testNumberGaps } from './authConfigGaps.mjs';

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

/** The seed's phone numbers, as Auth writes them: digits only, no plus sign. */
function seedNumbers() {
  const folder = new URL('../../supabase/seed/', import.meta.url);
  const seed = readdirSync(folder).filter((name) => name.endsWith('.sql')).map((name) => readFileSync(new URL(name, folder), 'utf8')).join('\n');
  return new Set([...seed.matchAll(/'\+(\d{10,15})'/g)].map((match) => match[1]));
}

// Production's one exception: the app stores' reviewer (decision 0575), as digits. None until the store apps go in for review.
const reviewer = (process.env.STORE_REVIEWER_NUMBER ?? '').replace(/\D/g, '');
const allowed = staging ? seedNumbers() : new Set(reviewer === '' ? [] : [reviewer]);
const gaps = testNumberGaps(auth.sms_test_otp, { staging, allowed });

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
