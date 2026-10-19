// A dealer tablet or TV pairs itself, signed out. A tablet (#41) sends the six-digit code staff read
// out from the console. The database redeems the code (redeem_device_pairing), counting wrong codes
// by the address they come from: too many, and it refuses for a while. A TV (#49) works the other way
// round: it asks for a code to show (start_tv_pairing, also limited by address), then asks every few
// seconds with the secret that came with it (check_tv_pairing) until staff type the code into the
// console. Either way, this function then gives the device its own Auth login: a number in +999, a
// country code no phone has, and a random password nobody keeps. It links the login to the device,
// signs it in once and returns the session. Auth's token hook lets a device login through only by
// that password, only while the device is paired. A login the device had before is removed, and its
// sessions with it. No vendor is called.
import { devicePairRequestSchema, type DevicePairRequest } from '@rivr/contracts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

// Only the device apps call this: the tablet's Android shell (https://localhost under Capacitor), a
// local preview, and the hosted tablet and TV bundles the shells load, which the deploy names in
// DEVICE_APP_ORIGINS (comma-separated). With JSON required (below), a web page elsewhere cannot make
// its visitors' browsers send codes or ask for them.
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

/** What the device is sent back, or why not. */
type Outcome = { reply: object } | { refusal: 'wrong_code' | 'too_many' | 'expired' };

/** The first row a database function returned. */
async function rpc(name: string, args: object): Promise<unknown> {
  const rows = await call(`/rest/v1/rpc/${name}`, AS_SERVER, args);
  return Array.isArray(rows) ? rows[0] : undefined;
}

/** Signs the device's new login in once, and returns the session. */
async function sessionOf(login: { phone: string; password: string }): Promise<object> {
  // As the server: Auth's CAPTCHA (#182) is for people signing in, and it skips the service role.
  const session = await call('/auth/v1/token?grant_type=password', AS_SERVER, login);
  return { access_token: field(session, 'access_token'), refresh_token: field(session, 'refresh_token') };
}

/**
 * Gives the device a new login, removes the one it had before (the database names it in `row`), and
 * signs the new one in: the session, or null when the device was revoked in the meantime.
 */
async function newSession(deviceId: string, row: unknown): Promise<object | null> {
  const login = await linkNewLogin(deviceId);
  if (login === null) return null;
  const previousUserId = field(row, 'previous_user_id');
  if (typeof previousUserId === 'string') await removeLogin(previousUserId);
  return await sessionOf(login);
}

/** A tablet: redeems the code and signs the tablet in. */
async function pair(code: string, client: string): Promise<Outcome> {
  const row = await rpc('redeem_device_pairing', { p_code: code, p_client: client });
  const deviceId = field(row, 'device_id');
  if (typeof deviceId !== 'string') return { refusal: field(row, 'refusal') === 'too_many' ? 'too_many' : 'wrong_code' };
  const session = await newSession(deviceId, row);
  return session === null ? { refusal: 'wrong_code' } : { reply: session };
}

/** A TV: a code to show, the secret to ask with, and when they run out. */
async function startTv(client: string): Promise<Outcome> {
  const row = await rpc('start_tv_pairing', { p_client: client });
  if (field(row, 'refusal') === 'too_many') return { refusal: 'too_many' };
  const code = field(row, 'code');
  if (typeof code !== 'string') throw new Error('start_tv_pairing returned no code');
  return { reply: { code, secret: field(row, 'secret'), expires_at: field(row, 'expires_at') } };
}

/** A TV asking again: its session once staff have claimed its code; waiting until then. */
async function checkTv(secret: string): Promise<Outcome> {
  const row = await rpc('check_tv_pairing', { p_secret: secret });
  const deviceId = field(row, 'device_id');
  if (typeof deviceId !== 'string') return field(row, 'refusal') === 'waiting' ? { reply: { waiting: true } } : { refusal: 'expired' };
  // Null when the TV was unpaired in the meantime: it starts again with a new code.
  const session = await newSession(deviceId, row);
  return session === null ? { refusal: 'expired' } : { reply: session };
}

function handle(input: DevicePairRequest, client: string): Promise<Outcome> {
  if ('code' in input) return pair(input.code, client);
  return input.tv === 'start' ? startTv(client) : checkTv(input.secret);
}

/** The caller's address, as private.request_ip reads it. */
function clientOf(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? '';
}

/** The reply, or the refusal: 429 for too many codes, 400 for a wrong code or a TV's secret no longer good. */
function answer(outcome: Outcome, headers: Record<string, string>): Response {
  if ('reply' in outcome) return Response.json(outcome.reply, { headers });
  return Response.json({ error: outcome.refusal }, { status: outcome.refusal === 'too_many' ? 429 : 400, headers });
}

Deno.serve(async (request) => {
  const headers = cors(request);
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers });
  // JSON only: a page elsewhere can send its visitors' browsers a plain-text POST without asking
  // first, but a JSON one needs the preflight above, which other origins fail.
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
    return Response.json({ error: 'invalid' }, { status: 415, headers });
  }
  const input = devicePairRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: 'invalid' }, { status: 400, headers });
  try {
    return answer(await handle(input.data, clientOf(request)), headers);
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 502, headers });
  }
});
