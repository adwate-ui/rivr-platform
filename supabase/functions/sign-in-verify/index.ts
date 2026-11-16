// Checks a sign-in code typed in an app, signed out (decision 0679). While Message Central's VerifyNow
// sends the codes, Auth's own code waits in the database (auth-send-code keeps it); a code VerifyNow
// accepts gets it back, and the app signs in with it. With no VerifyNow code sent to the number (VerifyNow
// off, or a test number) the app is told to check the typed code with Auth. Five tries per code sent,
// and 30 checks in five minutes from one address. The code and the phone are never logged.
import { checkSignInCode, type SignInCodeAttempt, type SignInCodeStore } from '@rivr/adapters/sign-in-code';
import { signInCheckSchema } from '@rivr/contracts';
import { liveVerifyNow, signInCodeRpc } from '../_shared/signInCodes.ts';

// Only the apps that sign people in by code: the player app and the console, on the hosts the CAPTCHA
// widget allows (runbook ci-and-release.md, Turnstile), their staging projects and previews, the
// player's Android and iPhone shells, and a local stack. With JSON required (below), a page elsewhere
// cannot make its visitors' browsers spend members' tries.
const APP_ORIGIN =
  /^(https:\/\/((app|console)\.rivrpoker\.com|([a-z0-9-]+\.)?rivr-(player|console)(-staging)?\.pages\.dev|localhost)|capacitor:\/\/localhost|http:\/\/(localhost|127\.0\.0\.1):\d+)$/;

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  return {
    'access-control-allow-origin': APP_ORIGIN.test(origin) ? origin : 'https://app.rivrpoker.com',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
}

/**
 * The caller's address, as device-pair reads it: Cloudflare's; without it (the local stack), the last
 * X-Forwarded-For hop, which the gateway added. The first is whatever the client sent (decision 0287).
 */
function clientOf(request: Request): string {
  const forwarded = (request.headers.get('x-forwarded-for') ?? '').split(',');
  return request.headers.get('cf-connecting-ip') ?? forwarded[forwarded.length - 1]?.trim() ?? '';
}

const textOf = (row: unknown, name: string): string | null => {
  const value: unknown = typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined;
  return typeof value === 'string' ? value : null;
};

/** sign_in_code_attempt's one row, read as what to do with the code. */
function attemptOf(rows: unknown): SignInCodeAttempt {
  const row: unknown = Array.isArray(rows) ? rows[0] : undefined;
  const [verificationId, token] = [textOf(row, 'verification_id'), textOf(row, 'auth_code')];
  if (textOf(row, 'refusal') === 'too_many') return { refusal: 'too_many' };
  if (token !== null) return { token };
  return verificationId === null ? null : { verificationId };
}

const store: SignInCodeStore = {
  attempt: async ({ phone, code, client }) =>
    attemptOf(await signInCodeRpc('sign_in_code_attempt', { p_phone: phone, p_code: code, p_client: client }, 2_000)),
  take: async ({ phone, verificationId, code }) => {
    const token: unknown = await signInCodeRpc('take_sign_in_code', { p_phone: phone, p_verification_id: verificationId, p_code: code }, 2_000);
    return typeof token === 'string' ? token : null;
  },
};

Deno.serve(async (request) => {
  const headers = cors(request);
  const answer = (body: object, status: number) => Response.json(body, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return answer({ error: 'invalid' }, 405);
  // JSON only: a page elsewhere can send its visitors' browsers a plain-text POST without asking
  // first, but a JSON one needs the preflight above, which other origins fail.
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return answer({ error: 'invalid' }, 415);
  const input = signInCheckSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return answer({ error: 'invalid' }, 400);
  try {
    const { status, body } = await checkSignInCode({ ...input.data, client: clientOf(request) }, liveVerifyNow(), store);
    return answer(body, status);
  } catch {
    // The database did not answer. Trying the same code again works unless VerifyNow had already accepted it.
    return answer({ error: 'unavailable' }, 502);
  }
});
