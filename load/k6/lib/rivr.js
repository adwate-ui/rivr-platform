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

/** The test phone number for this virtual user, wrapping round the list. */
export function phoneFor(vu) {
  const phones = (__ENV.LOAD_PHONES || '').split(',').filter(Boolean);
  if (phones.length === 0) fail('Set LOAD_PHONES to staging test numbers.');
  return phones[(vu - 1) % phones.length];
}

/** Signs in with a test number and code; returns the access token. */
export function signIn(phone) {
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

/** A unique idempotency key for one write. */
export function idempotencyKey() {
  return `load-${__VU}-${__ITER}-${Date.now()}`;
}
