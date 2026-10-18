#!/usr/bin/env node
/**
 * Checks a project's Auth settings once its migrations are in (#187, runbook "Auth and API").
 * While phone sign-in is on, a session must come only from a code: the access-token hook on,
 * calling private.require_code_sign_in; phone confirmations on; the email provider off.
 * `--warn` reports a gap as a warning (staging); otherwise it fails the job (a release).
 * Needs SUPABASE_ACCESS_TOKEN and PROJECT_REF.
 */
const HOOK_URI = 'pg-functions://postgres/private/require_code_sign_in';

const REQUIRED = [
  ['hook_custom_access_token_enabled', true, 'the Customize Access Token hook is on'],
  ['hook_custom_access_token_uri', HOOK_URI, `the hook calls ${HOOK_URI}`],
  ['sms_autoconfirm', false, 'phone confirmations are on ("Confirm phone")'],
  ['external_email_enabled', false, 'the email provider is off'],
];

const warnOnly = process.argv.includes('--warn');
const { SUPABASE_ACCESS_TOKEN: token, PROJECT_REF: ref } = process.env;
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and PROJECT_REF are required');

const reply = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { headers: { authorization: `Bearer ${token}` } });
if (!reply.ok) throw new Error(`Reading the Auth settings failed: HTTP ${reply.status}`);
const auth = await reply.json();

if (auth.external_phone_enabled !== true) {
  process.stdout.write('::notice::Phone sign-in is off on this project, so the code-only settings are not required yet.\n');
  process.exit(0);
}
const gaps = REQUIRED.filter(([field, expected]) => auth[field] !== expected).map(([, , rule]) => rule);
for (const gap of gaps) {
  process.stdout.write(`::${warnOnly ? 'warning' : 'error'}::Phone sign-in is on, but not yet: ${gap}. See docs/runbooks/ci-and-release.md.\n`);
}
if (gaps.length === 0) process.stdout.write('Auth settings: sessions come only from a code.\n');
process.exit(gaps.length > 0 && !warnOnly ? 1 : 0);
