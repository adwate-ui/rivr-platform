// A dealer tablet or TV pairs itself (#41), signed out: it sends the six-digit code staff read out
// from the console. The database redeems the code (redeem_device_pairing), counting wrong codes by
// the address they come from: too many, and it refuses for a while. This function then gives the
// device its own Auth login: a number in +999, a country code no phone has, and a random password
// nobody keeps. It links the login to the device, signs it in once and returns the session. Auth's
// token hook lets a device login through only by that password, only while the device is paired.
// A login the device had before is removed, and its sessions with it. No vendor is called.
import { devicePairSchema } from '@rivr/contracts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

// Only the device apps call this: the tablet's Android shell (https://localhost under Capacitor), a
// local preview, and the hosted tablet and TV bundles the shells load, which the deploy names in
// DEVICE_APP_ORIGINS (comma-separated). A web page elsewhere cannot make its visitors' browsers send codes.
const DEVICE_ORIGIN = /^(https:\/\/localhost|capacitor:\/\/localhost|http:\/\/(localhost|127\.0\.0\.1):\d+)$/;
const HOSTED_ORIGINS = (Deno.env.get('DEVICE_APP_ORIGINS') ?? '').split(',').flatMap((address) => {
  try {
    return [new URL(address.trim()).origin];
  } catch {
    return [];
  }
});

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const isDevice = DEVICE_ORIGIN.test(origin) || HOSTED_ORIGINS.includes(origin);
  return {
    'access-control-allow-origin': isDevice ? origin : 'https://localhost',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
}

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
}

/** Calls Auth or the database; throws when it fails. */
async function call(path: string, headers: HeadersInit, body?: object, method = 'POST'): Promise<unknown> {
  const answer = await fetch(`${supabaseUrl}${path}`, {
    method, headers, body: body === undefined ? null : JSON.stringify(body), signal: AbortSignal.timeout(5_000),
  });
  if (!answer.ok) throw new Error(`${path} failed (${answer.status})`);
  return answer.status === 204 ? null : await answer.json();
}

/** A new login for the device: a +999 number and a password with every kind of character, whatever Auth's rules. */
function newLogin(): { phone: string; password: string } {
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte % 10).join('');
  const password = `${btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))}aA1!`;
  return { phone: `999${digits}`, password };
}

async function removeLogin(userId: string): Promise<void> {
  await call(`/auth/v1/admin/users/${userId}`, AS_SERVER, undefined, 'DELETE');
}

/** Makes the device's login and links it; the login is removed again unless the device holds it. */
async function linkNewLogin(deviceId: string): Promise<{ phone: string; password: string } | null> {
  const login = newLogin();
  const user = await call('/auth/v1/admin/users', AS_SERVER, {
    phone: login.phone, password: login.password, phone_confirm: true, app_metadata: { device_id: deviceId },
  });
  const userId = String(field(user, 'id'));
  let isLinked = false;
  try {
    // False when the device was revoked since the code was redeemed.
    isLinked = (await call('/rest/v1/rpc/link_device_login', AS_SERVER, { p_device_id: deviceId, p_user_id: userId })) === true;
  } finally {
    if (!isLinked) await removeLogin(userId).catch(() => undefined);
  }
  return isLinked ? login : null;
}

/** Redeems the code and signs the device in: its session, or why not. */
async function pair(code: string, client: string): Promise<{ session: object } | { refusal: string }> {
  const redeemed = await call('/rest/v1/rpc/redeem_device_pairing', AS_SERVER, { p_code: code, p_client: client });
  const row: unknown = Array.isArray(redeemed) ? redeemed[0] : undefined;
  const deviceId = field(row, 'device_id');
  if (typeof deviceId !== 'string') return { refusal: field(row, 'refusal') === 'too_many' ? 'too_many' : 'wrong_code' };
  const login = await linkNewLogin(deviceId);
  if (login === null) return { refusal: 'wrong_code' };
  const previousUserId = field(row, 'previous_user_id');
  if (typeof previousUserId === 'string') await removeLogin(previousUserId);
  // As the server: Auth's CAPTCHA (#182) is for people signing in, and it skips the service role.
  const session = await call('/auth/v1/token?grant_type=password', AS_SERVER, login);
  return { session: { access_token: field(session, 'access_token'), refresh_token: field(session, 'refresh_token') } };
}

/** The caller's address, as private.request_ip reads it. */
function clientOf(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? '';
}

/** The session, or the refusal: 429 for too many wrong codes, 400 for a wrong one. */
function answer(paired: { session: object } | { refusal: string }, headers: Record<string, string>): Response {
  if ('session' in paired) return Response.json(paired.session, { headers });
  return Response.json({ error: paired.refusal }, { status: paired.refusal === 'too_many' ? 429 : 400, headers });
}

Deno.serve(async (request) => {
  const headers = cors(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers });
  const input = devicePairSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: 'invalid' }, { status: 400, headers });
  try {
    return answer(await pair(input.data.code, clientOf(request)), headers);
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 502, headers });
  }
});
