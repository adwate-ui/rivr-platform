// A dealer tablet or TV pairs itself (#41), signed out: it sends the six-digit code staff read out
// from the console. The database redeems the code (redeem_device_pairing, where wrong codes count
// against every live one). This function then gives the device its own Auth login: a number in +999,
// a country code no phone has, and a random password nobody keeps. It links the login to the device,
// signs it in once and returns the session. Auth's token hook lets a password session through only
// for a paired device that is not revoked. A login the device had before is removed, and its sessions
// with it. No vendor is called.
import { devicePairSchema } from '@rivr/contracts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function reply(body: object, status = 200): Response {
  return Response.json(body, { status, headers: CORS });
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

/** Redeems the code, makes and links the device's login, and signs it in. Null for a wrong code. */
async function pair(code: string): Promise<object | null> {
  const redeemed = await call('/rest/v1/rpc/redeem_device_pairing', AS_SERVER, { p_code: code });
  const row: unknown = Array.isArray(redeemed) ? redeemed[0] : undefined;
  const deviceId = field(row, 'device_id');
  if (typeof deviceId !== 'string') return null;
  const login = newLogin();
  const user = await call('/auth/v1/admin/users', AS_SERVER, {
    phone: login.phone, password: login.password, phone_confirm: true, app_metadata: { device_id: deviceId },
  });
  const userId = String(field(user, 'id'));
  // False when the device was revoked since the code was redeemed: its new login goes again.
  if ((await call('/rest/v1/rpc/link_device_login', AS_SERVER, { p_device_id: deviceId, p_user_id: userId })) !== true) {
    await removeLogin(userId);
    return null;
  }
  const previousUserId = field(row, 'previous_user_id');
  if (typeof previousUserId === 'string') await removeLogin(previousUserId);
  // As the server: Auth's CAPTCHA (#182) is for people signing in, and it skips the service role.
  const session = await call('/auth/v1/token?grant_type=password', AS_SERVER, login);
  return { access_token: field(session, 'access_token'), refresh_token: field(session, 'refresh_token') };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const input = devicePairSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return reply({ error: 'invalid' }, 400);
  try {
    const session = await pair(input.data.code);
    return session === null ? reply({ error: 'wrong_code' }, 400) : reply(session);
  } catch {
    return reply({ error: 'unavailable' }, 502);
  }
});
