import { memberIdSchema, panSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeKyc, createUnconfiguredKyc } from './index.ts';

const memberId = memberIdSchema.parse('3f2b8c4e-9d1a-4b6f-8e2c-7a5d9f0b1c3e');
const returnUrl = 'https://app.rivr.test/kyc/return';

describe('fake KYC', () => {
  it('runs the DigiLocker hand-off, straight back to the app, and returns only a masked Aadhaar', async () => {
    const kyc = createFakeKyc();
    const session = await kyc.startDigiLocker({ memberId, returnUrl });
    if (!session.ok) throw new Error('expected a session');

    // A new fake, as a later Edge Function invocation would have, still knows the session.
    const pulled = await createFakeKyc().pullDigiLocker({ sessionId: session.value.sessionId });

    expect(session.value.redirectUrl).toBe(returnUrl);
    expect(pulled.ok && pulled.value.maskedAadhaar).toMatch(/^XXXX XXXX \d{4}$/);
    expect(kyc.calls.map((call) => call.method)).toEqual(['startDigiLocker']);
  });

  it('refuses to pull a session it never started', async () => {
    const kyc = createFakeKyc();

    expect(await kyc.pullDigiLocker({ sessionId: 'nope' })).toEqual({
      ok: false,
      error: { code: 'rejected', reason: 'unknown DigiLocker session' },
    });
  });

  it('verifies a PAN when DigiLocker has none, valid unless told otherwise', async () => {
    const pan = panSchema.parse('ABCPE1234F');
    const input = { pan, name: 'Test Member', dateOfBirth: '1990-01-01' };

    expect(await createFakeKyc().verifyPan(input)).toMatchObject({ ok: true, value: { isValid: true } });
    expect(await createFakeKyc({ isPanValid: false }).verifyPan(input)).toMatchObject({ value: { isValid: false } });
  });

  it('passes liveness and face match by default, and fails them when a test asks', async () => {
    const selfieUrl = 'https://storage.rivr.test/kyc/selfie.jpg';
    const passing = createFakeKyc();
    const failing = createFakeKyc({ liveness: { isLive: false, score: 12 }, faceMatch: { isMatch: false, score: 41 } });

    expect(await passing.checkLiveness({ selfieUrl })).toMatchObject({ value: { isLive: true } });
    expect(await passing.matchFace({ selfieUrl, referenceUrl: selfieUrl })).toMatchObject({ value: { isMatch: true } });
    expect(await failing.checkLiveness({ selfieUrl })).toMatchObject({ value: { isLive: false, score: 12 } });
    expect(await failing.matchFace({ selfieUrl, referenceUrl: selfieUrl })).toMatchObject({ value: { score: 41 } });
  });

  it('returns a scripted vendor failure on the next call only', async () => {
    const kyc = createFakeKyc();
    kyc.failNext({ code: 'unavailable' });

    expect(await kyc.startDigiLocker({ memberId, returnUrl })).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect((await kyc.startDigiLocker({ memberId, returnUrl })).ok).toBe(true);
  });
});

describe('unconfigured KYC', () => {
  it('fails closed on every check, so staff verify by hand', async () => {
    const kyc = createUnconfiguredKyc();
    const notConfigured = { ok: false, error: { code: 'not_configured' } };

    expect(await kyc.startDigiLocker({ memberId, returnUrl })).toEqual(notConfigured);
    expect(await kyc.pullDigiLocker({ sessionId: 'any' })).toEqual(notConfigured);
    expect(await kyc.verifyPan({ pan: panSchema.parse('ABCPE1234F'), name: 'A', dateOfBirth: '1990-01-01' })).toEqual(
      notConfigured,
    );
    expect(await kyc.checkLiveness({ selfieUrl: 'x' })).toEqual(notConfigured);
    expect(await kyc.matchFace({ selfieUrl: 'x', referenceUrl: 'y' })).toEqual(notConfigured);
  });
});
