// Shared helpers for the k6 load tests (additions, "Load test"). They call the Supabase API the
// apps use: PostgREST RPCs named in docs/contracts/ and the public views.
//   SUPABASE_URL              the staging project, for example https://<ref>.supabase.co
//   SUPABASE_PUBLISHABLE_KEY  its publishable key
//   LOAD_PHONES               comma-separated test numbers (staging test OTP numbers)
//   LOAD_OTP                  the test code those numbers accept
import http from 'k6/http';
import { fail } from 'k6';

export const BASE = __ENV.SUPABASE_URL;
const KEY = __ENV.SUPABASE_PUBLISHABLE_KEY;

if (!BASE || !KEY) fail('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (staging; never production).');

/** Headers for a request as a signed-in user, or as the public with no token. */
export function headers(token) {
  return {
    apikey: KEY,
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

/** The test phone numbers, each signed in once in setup(): Auth limits sign-ins per address (30 in five minutes). */
export function loadPhones() {
  const phones = (__ENV.LOAD_PHONES || '').split(',').filter(Boolean);
  if (phones.length === 0) fail('Set LOAD_PHONES to staging test numbers.');
  return phones;
}

/** Signs every test number in once, for setup(); each virtual user then takes one with tokenFor. */
export function signInAll() {
  return loadPhones().map((phone) => signIn(phone));
}

/** This virtual user's token, wrapping round the numbers signed in. */
export function tokenFor(tokens, vu) {
  return tokens[(vu - 1) % tokens.length];
}

/** Signs in with a test number and code; returns the access token. */
export function signIn(phone) {
  http.post(`${BASE}/auth/v1/otp`, JSON.stringify({ phone }), { headers: headers(), tags: { name: 'sign-in-code' } });
  const response = http.post(
    `${BASE}/auth/v1/verify`,
    JSON.stringify({ phone, token: __ENV.LOAD_OTP, type: 'sms' }),
    { headers: headers(), tags: { name: 'sign-in' } },
  );
  if (response.status !== 200) fail(`sign-in failed for ${phone}: ${response.status}`);
  return response.json('access_token');
}

/** Calls a PostgREST function. */
export function rpc(name, body, token) {
  return http.post(`${BASE}/rest/v1/rpc/${name}`, JSON.stringify(body), { headers: headers(token), tags: { name } });
}

/** Reads a table or view. */
export function read(path, token) {
  return http.get(`${BASE}/rest/v1/${path}`, { headers: headers(token), tags: { name: path.split('?')[0] } });
}

/** A unique idempotency key for one write: the functions take a UUID. */
export function idempotencyKey() {
  return crypto.randomUUID();
}
