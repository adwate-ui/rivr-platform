import { memberIdSchema, panSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createCashfreeKyc } from './cashfree.ts';

const memberId = memberIdSchema.parse('8d0c7b6a-5f4e-4d3c-9b2a-1e0f9d8c7b6a');
const SELFIE = 'https://storage.rivr.test/kyc/selfie.jpg?token=signed';

async function makePublicKey() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-1' }, true, ['encrypt', 'decrypt'],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  return `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...spki))}\n-----END PUBLIC KEY-----`;
}

// One key for the file: making a 2,048-bit RSA key for every case is slow enough to time out on a busy runner.
let publicKeyMade: Promise<string> | undefined;
function publicKey(): Promise<string> {
  publicKeyMade ??= makePublicKey();
  return publicKeyMade;
}

/** Cashfree's sandbox as its API reference documents it: each path answers with the reply given. */
async function cashfree(replies: Record<string, { status?: number; body: unknown }>) {
  const sent: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('data:')) return globalThis.fetch(url);
    if (url === SELFIE) return new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'content-type': 'image/jpeg' } });
    sent.push({ url, body: init?.body });
    const path = new URL(url).pathname;
    const reply = replies[path] ?? { status: 404, body: { code: 'not_found' } };
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const kyc = createCashfreeKyc({ clientId: 'CF1', clientSecret: 's', publicKey: await publicKey(), environment: 'sandbox', fetch });
  return { kyc, sent };
}

const AADHAAR = {
  status: 'SUCCESS', name: ' John Doe ', dob: '02-02-1995', uid: 'xxxxxxxx5647', photo_link: 'aGVsbG8=',
  split_address: { house: '12', street: 'Main Road', vtc: 'Sector 65', dist: 'Gurugram', state: 'Haryana', pincode: '122018', country: 'India' },
};

describe('Cashfree Secure ID', () => {
  it('starts DigiLocker for the Aadhaar and PAN, and sends the member to Cashfree\'s page', async () => {
    const { kyc, sent } = await cashfree({ '/verification/digilocker': { body: { url: 'https://sandbox.cashfree.com/digilocker/x', status: 'PENDING' } } });
    const session = await kyc.startDigiLocker({ memberId, returnUrl: 'https://app.rivr.test/kyc/return' });
    expect(session).toMatchObject({ ok: true, value: { redirectUrl: 'https://sandbox.cashfree.com/digilocker/x' } });
    expect(JSON.parse(String(sent[0]?.body))).toMatchObject({
      document_requested: ['AADHAAR', 'PAN'], redirect_url: 'https://app.rivr.test/kyc/return', user_flow: 'signup',
    });
  });

  it('pulls the Aadhaar with its last four digits and photo, and the PAN when DigiLocker holds one', async () => {
    const { kyc } = await cashfree({
      '/verification/digilocker/document/AADHAAR': { body: AADHAAR },
      '/verification/digilocker/document/PAN': { body: { pan: 'abcpv1234d', name_pan_card: 'JOHN DOE' } },
    });
    expect(await kyc.pullDigiLocker({ sessionId: 'rivr-1' })).toEqual({
      ok: true,
      value: {
        name: 'John Doe', dateOfBirth: '1995-02-02', maskedAadhaar: 'XXXX XXXX 5647', aadhaarReference: null, pan: panSchema.parse('ABCPV1234D'),
        address: '12, Main Road, Sector 65, Gurugram, Haryana, 122018', photoUrl: 'data:image/jpeg;base64,aGVsbG8=', vendorReference: 'rivr-1',
      },
    });
  });

  it('pulls no PAN when DigiLocker has none, and refuses an Aadhaar not linked', async () => {
    const withoutPan = await cashfree({ '/verification/digilocker/document/AADHAAR': { body: AADHAAR } });
    expect(await withoutPan.kyc.pullDigiLocker({ sessionId: 'rivr-1' })).toMatchObject({ ok: true, value: { pan: null } });
    const unlinked = await cashfree({ '/verification/digilocker/document/AADHAAR': { body: { ...AADHAAR, status: 'AADHAAR_NOT_LINKED' } } });
    expect(await unlinked.kyc.pullDigiLocker({ sessionId: 'rivr-1' }))
      .toEqual({ ok: false, error: { code: 'rejected', reason: 'Cashfree DigiLocker AADHAAR_NOT_LINKED' } });
  });

  it('checks a PAN with the name and date of birth, as the sandbox answers ABCPV1234D and DEFPV0126D', async () => {
    const valid = await cashfree({ '/verification/pan-lite': { body: { status: 'VALID', name_match: 'Y', dob_match: 'Y', reference_id: 77 } } });
    expect(await valid.kyc.verifyPan({ pan: panSchema.parse('ABCPV1234D'), name: 'John Doe', dateOfBirth: '1995-02-02' }))
      .toEqual({ ok: true, value: { isValid: true, nameMatches: true, dateOfBirthMatches: true, vendorReference: '77' } });
    expect(JSON.parse(String(valid.sent[0]?.body))).toMatchObject({ pan: 'ABCPV1234D', name: 'John Doe', dob: '1995-02-02' });
    const invalid = await cashfree({ '/verification/pan-lite': { body: { status: 'INVALID', name_match: null, dob_match: null, pan_status: 'N', reference_id: 78 } } });
    expect(await invalid.kyc.verifyPan({ pan: panSchema.parse('DEFPV0126D'), name: 'John Doe', dateOfBirth: '1995-02-02' }))
      .toMatchObject({ ok: true, value: { isValid: false, nameMatches: false, dateOfBirthMatches: false } });
    // Someone else's PAN in the same name: valid, the name matches, the date of birth does not.
    const stranger = await cashfree({ '/verification/pan-lite': { body: { status: 'VALID', name_match: 'Y', dob_match: 'N' } } });
    expect(await stranger.kyc.verifyPan({ pan: panSchema.parse('ABCPV1234D'), name: 'John Doe', dateOfBirth: '1990-01-01' }))
      .toMatchObject({ ok: true, value: { isValid: true, nameMatches: true, dateOfBirthMatches: false } });
  });

  it('sends the member only to a Cashfree page over https', async () => {
    const elsewhere = await cashfree({ '/verification/digilocker': { body: { url: 'javascript:alert(1)' } } });
    expect(await elsewhere.kyc.startDigiLocker({ memberId, returnUrl: 'https://app.rivr.test/kyc/return' }))
      .toEqual({ ok: false, error: { code: 'unavailable' } });
    const lookalike = await cashfree({ '/verification/digilocker': { body: { url: 'https://cashfree.com.evil.test/x' } } });
    expect(await lookalike.kyc.startDigiLocker({ memberId, returnUrl: 'https://app.rivr.test/kyc/return' })).toMatchObject({ ok: false });
  });

  it('sends the selfie as a file for liveness, and reads a real face as live', async () => {
    const live = await cashfree({ '/verification/face-liveness': { body: { status: 'SUCCESS', liveness: true, liveness_score: 0.934, ref_id: 5 } } });
    expect(await live.kyc.checkLiveness({ selfieUrl: SELFIE })).toEqual({ ok: true, value: { isLive: true, score: 93, vendorReference: '5' } });
    const form = live.sent[0]?.body;
    expect(form instanceof FormData && form.get('image') instanceof Blob).toBe(true);
    const notReal = await cashfree({ '/verification/face-liveness': { body: { status: 'REAL_FACE_NOT_DETECTED', liveness: false, liveness_score: 0.2 } } });
    expect(await notReal.kyc.checkLiveness({ selfieUrl: SELFIE })).toMatchObject({ ok: true, value: { isLive: false, score: 20 } });
  });

  it('matches the selfie with DigiLocker\'s photo, both sent as files', async () => {
    const { kyc, sent } = await cashfree({ '/verification/face-match': { body: { status: 'SUCCESS', face_match_result: 'YES', face_match_score: 0.88 } } });
    expect(await kyc.matchFace({ selfieUrl: SELFIE, referenceUrl: 'data:image/jpeg;base64,aGVsbG8=' }))
      .toMatchObject({ ok: true, value: { isMatch: true, score: 88 } });
    const form = sent[0]?.body;
    expect(form instanceof FormData && form.get('first_image') instanceof Blob && form.get('second_image') instanceof Blob).toBe(true);
  });

  it('is unavailable when the selfie cannot be read, or Cashfree answers what it does not document', async () => {
    const { kyc } = await cashfree({ '/verification/pan-lite': { body: { unexpected: true } } });
    expect(await kyc.checkLiveness({ selfieUrl: 'https://storage.rivr.test/gone.jpg' })).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await kyc.verifyPan({ pan: panSchema.parse('ABCPV1234D'), name: 'John Doe', dateOfBirth: '1995-02-02' }))
      .toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
