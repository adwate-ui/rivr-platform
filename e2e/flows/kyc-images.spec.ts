/**
 * KYC images (#3): staff get a one-minute link to an image only through the kyc-image-url Edge
 * Function, and only with KYC review or the cage at its venue. Local stack only: it uploads a
 * test image with the service role, which never leaves this machine.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { localBinary, localSupabaseEnv, worktreeRoot } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';

const PATH = '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000201/e2e-aadhaar.png';
// A one-pixel PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

function serviceRoleKey(): string {
  const root = worktreeRoot();
  const status: unknown = JSON.parse(execFileSync(localBinary('supabase', root), ['status', '-o', 'json'], { cwd: root, encoding: 'utf8' }));
  const key: unknown = typeof status === 'object' && status !== null ? Reflect.get(status, 'SERVICE_ROLE_KEY') : undefined;
  if (typeof key !== 'string') throw new Error('The local stack is not running');
  return key;
}

/** Signs a seeded person in with the local test code and returns their access token. */
async function signIn(request: APIRequestContext, phone: string): Promise<string> {
  const { url, publishableKey } = localSupabaseEnv();
  const headers = { apikey: publishableKey, 'content-type': 'application/json' };
  await request.post(`${url}/auth/v1/otp`, { headers, data: { phone } });
  const session = await request.post(`${url}/auth/v1/verify`, { headers, data: { type: 'sms', phone, token: '123456' } });
  const token: unknown = Reflect.get(await session.json(), 'access_token');
  if (typeof token !== 'string') throw new Error(`${phone} could not sign in`);
  return token;
}

test.describe('KYC images', () => {
  test.skip(isRemoteTarget(), 'uploads with the service role, so the local stack only');

  test('a KYC reviewer gets a one-minute link; a host gets none; nobody signs directly', async ({ request }) => {
    const { url, publishableKey } = localSupabaseEnv();
    const service = serviceRoleKey();
    await request.post(`${url}/storage/v1/object/kyc/${PATH}`, {
      headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'image/png', 'x-upsert': 'true' },
      data: PNG,
    });
    const ask = (token: string) =>
      request.post(`${url}/functions/v1/kyc-image-url`, {
        headers: { apikey: publishableKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        data: { path: PATH },
      });

    const admin = await signIn(request, '+919000000103');
    const allowed = await ask(admin);
    expect(allowed.status()).toBe(200);
    const signedPath: unknown = Reflect.get(await allowed.json(), 'signedPath');
    expect(typeof signedPath).toBe('string');
    const link = new URL(`${url}/storage/v1${String(signedPath)}`);
    expect((await request.get(link.toString())).status()).toBe(200);
    const claims: unknown = JSON.parse(Buffer.from(String(link.searchParams.get('token')).split('.')[1] ?? '', 'base64url').toString());
    expect(Number(Reflect.get(Object(claims), 'exp')) - Number(Reflect.get(Object(claims), 'iat'))).toBe(60);

    const direct = await request.post(`${url}/storage/v1/object/sign/kyc/${PATH}`, {
      headers: { apikey: publishableKey, authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
      data: { expiresIn: 315360000 },
    });
    expect(direct.ok()).toBe(false);

    // A path that climbs out of its venue folder never reaches the database or Storage.
    const climbing = await request.post(`${url}/functions/v1/kyc-image-url`, {
      headers: { apikey: publishableKey, authorization: `Bearer ${admin}`, 'content-type': 'application/json' },
      data: { path: `00000000-0000-4000-8000-000000000002/../${PATH}` },
    });
    expect(climbing.status()).toBe(400);

    const host = await signIn(request, '+919000000108');
    expect((await ask(host)).status()).toBe(403);
  });
});
