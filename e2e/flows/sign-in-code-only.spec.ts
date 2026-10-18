/**
 * Sign-in: Auth opens a session only for a code (#187). Someone who knows a number signs it up
 * with a password before its owner's first sign-in; the owner then signs in by code, and the
 * password must still never open a session. Runs on the local stack only: it signs a number up
 * with a password, which must never happen on staging.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { localSupabaseEnv } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';

// A local test number that is not seeded (supabase/config.template.toml, [auth.sms.test_otp]).
const PHONE = '+919000000901';
const TEST_CODE = '123456';
const PASSWORD = 'set-before-the-owner-1';

function authApi(request: APIRequestContext) {
  const { url, publishableKey } = localSupabaseEnv();
  const headers = { apikey: publishableKey, 'content-type': 'application/json' };
  return (path: string, data: object) => request.post(`${url}/auth/v1/${path}`, { headers, data });
}

test.describe('sign-in: code only', () => {
  test.skip(isRemoteTarget(), 'signs a number up with a password, so the local stack only');

  test('a password set before the owner first signs in never opens a session', async ({ request }) => {
    const auth = authApi(request);

    // With phone confirmations on, Auth answers 200 even when an earlier run made the account,
    // and a test number takes its code whether or not one is pending, so a rerun passes too.
    expect((await auth('signup', { phone: PHONE, password: PASSWORD })).status()).toBe(200);

    // The owner's first sign-in by code confirms the number; that session is issued and refreshes.
    const byCode = await auth('verify', { type: 'sms', phone: PHONE, token: TEST_CODE });
    expect(byCode.status()).toBe(200);
    const refreshToken: unknown = Reflect.get(await byCode.json(), 'refresh_token');
    expect(typeof refreshToken).toBe('string');
    expect((await auth('token?grant_type=refresh_token', { refresh_token: refreshToken })).status()).toBe(200);

    const byPassword = await auth('token?grant_type=password', { phone: PHONE, password: PASSWORD });
    expect(byPassword.status()).toBe(403);
    expect(await byPassword.json()).toMatchObject({ msg: 'Sign in with the code sent to your phone.' });
  });
});
