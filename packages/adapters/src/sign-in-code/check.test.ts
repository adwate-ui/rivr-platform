import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeVerifyNow } from '../verify-now/index.ts';
import { checkSignInCode, type SignInCodeAttempt, type SignInCodeStore } from './index.ts';

const phone = indianMobileSchema.parse('+919000000201');
const client = '198.51.100.1';

/**
 * The database's side, as `sign_in_code_attempt` and `take_sign_in_code` keep it: one VerifyNow check
 * waiting for the number with Auth's code, five tries, and the accepted code good again for a retry.
 */
function storeWith(verificationId: string | null, authCode = '1357924680') {
  let tries = 0;
  let accepted: string | null = null;
  const takes: { verificationId: string; code: string }[] = [];
  const store: SignInCodeStore = {
    attempt: async ({ code }): Promise<SignInCodeAttempt> => {
      tries += 1;
      if (verificationId === null || tries > 5) return null;
      if (accepted !== null) return code === accepted ? { token: authCode } : null;
      return { verificationId };
    },
    take: async (input) => {
      takes.push({ verificationId: input.verificationId, code: input.code });
      if (accepted !== null || input.verificationId !== verificationId) return null;
      accepted = input.code;
      return authCode;
    },
  };
  return { store, takes };
}

/** A fake VerifyNow that has texted the number, and the code it texted. */
async function texted() {
  const verifyNow = createFakeVerifyNow();
  const sent = await verifyNow.send({ to: phone });
  const verificationId = sent.ok ? sent.value.verificationId ?? '' : '';
  return { verifyNow, verificationId, code: verifyNow.codeOf(verificationId) ?? '' };
}

describe('checkSignInCode', () => {
  it('gives back Auth\'s code for the code VerifyNow texted, under the check VerifyNow accepted', async () => {
    const { verifyNow, verificationId, code } = await texted();
    const { store, takes } = storeWith(verificationId);

    expect(await checkSignInCode({ phone, code, client }, verifyNow, store)).toEqual({ status: 200, body: { token: '1357924680' } });
    expect(takes).toEqual([{ verificationId, code }]);
  });

  it('gives it again for the same code, as the database allows for two minutes, should signing in with it have failed', async () => {
    const { verifyNow, verificationId, code } = await texted();
    const { store } = storeWith(verificationId);
    await checkSignInCode({ phone, code, client }, verifyNow, store);

    expect(await checkSignInCode({ phone, code, client }, verifyNow, store)).toEqual({ status: 200, body: { token: '1357924680' } });
    expect(await checkSignInCode({ phone, code: '000000', client }, verifyNow, store)).toEqual({ status: 200, body: { token: null } });
  });

  it('refuses a wrong code and gives nothing back', async () => {
    const { verifyNow, verificationId } = await texted();
    const { store, takes } = storeWith(verificationId);

    expect(await checkSignInCode({ phone, code: '000000', client }, verifyNow, store)).toEqual({ status: 400, body: { error: 'code_rejected' } });
    expect(takes).toEqual([]);
  });

  it('refuses a code whose check is no longer the number\'s: a new code was sent meanwhile', async () => {
    const { verifyNow, verificationId, code } = await texted();
    const replaced: SignInCodeStore = { attempt: async () => ({ verificationId }), take: async () => null };

    expect(await checkSignInCode({ phone, code, client }, verifyNow, replaced)).toEqual({ status: 400, body: { error: 'code_rejected' } });
  });

  it('stops checking after five tries: the sixth, even the right code, goes to Auth, which refuses it', async () => {
    const { verifyNow, verificationId, code } = await texted();
    const { store } = storeWith(verificationId);
    for (let attempt = 0; attempt < 5; attempt += 1) await checkSignInCode({ phone, code: '000000', client }, verifyNow, store);

    expect(await checkSignInCode({ phone, code, client }, verifyNow, store)).toEqual({ status: 200, body: { token: null } });
  });

  it('says to wait when the address has checked too often, without asking VerifyNow', async () => {
    const { verifyNow, verificationId, code } = await texted();
    const tooOften: SignInCodeStore = { attempt: async () => ({ refusal: 'too_many' }), take: async () => 'never' };

    expect(await checkSignInCode({ phone, code, client }, verifyNow, tooOften)).toEqual({ status: 429, body: { error: 'too_many_requests' } });
    expect(verifyNow.codeOf(verificationId)).toBe(code);
  });

  it('says to check the typed code with Auth when VerifyNow is off or sent this number nothing (a test number)', async () => {
    const { verifyNow } = await texted();

    expect(await checkSignInCode({ phone, code: '123456', client }, null, storeWith('v1').store)).toEqual({ status: 200, body: { token: null } });
    expect(await checkSignInCode({ phone, code: '123456', client }, verifyNow, storeWith(null).store)).toEqual({ status: 200, body: { token: null } });
  });

  it('says to wait at VerifyNow\'s limit, and that sign-in is down when VerifyNow does not answer', async () => {
    const tooMany = { send: createFakeVerifyNow().send, check: async () => ({ ok: false as const, error: 'too_many' as const }) };
    const down = { send: createFakeVerifyNow().send, check: async () => ({ ok: false as const, error: 'unavailable' as const }) };

    expect(await checkSignInCode({ phone, code: '123456', client }, tooMany, storeWith('v1').store)).toEqual({ status: 429, body: { error: 'too_many_requests' } });
    expect(await checkSignInCode({ phone, code: '123456', client }, down, storeWith('v1').store)).toEqual({ status: 502, body: { error: 'unavailable' } });
  });
});
