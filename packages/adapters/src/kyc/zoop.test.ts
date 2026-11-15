import { memberIdSchema, panSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createZoopKyc } from './zoop.ts';

const SELFIE = 'https://storage.rivr.test/kyc/selfie.jpg?token=signed';
const REFERENCE = 'data:image/jpeg;base64,/9j/AA==';
const pan = panSchema.parse('ABCPV1234D');

interface Reply {
  readonly status?: number;
  readonly body: unknown;
}

/** Zoop's envelope around a result, as its test host answers. */
const zoopReply = (code: string, result: unknown, requestId = 'zoop-request-1') => ({
  request_id: requestId, task_id: 'task', group_id: 'group', success: true, response_code: code,
  response_message: '', metadata: { billable: 'Y' }, result, request_timestamp: '', response_timestamp: '',
});

// Zoop's Face Match on its test host, 15 Nov 2026: one AI-made face against itself, and against another face.
const SAME_FACE = { ...zoopReply('100', { face_match_score: '100' }, '58f904a1'), response_message: 'Valid Authentication' };
const NOT_THE_SAME = { ...zoopReply('101', null, '9c835a58'), response_message: 'No Record Found' };

/** The selfie's storage: the selfie, a photo too large to send, or nothing; never through a redirect. */
function storage(url: string, init: RequestInit | undefined): Response {
  if (init?.redirect !== 'error') return new Response('', { status: 302 });
  if (url === SELFIE) return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
  if (url.endsWith('/huge.jpg')) return new Response(new Uint8Array(5 * 1024 * 1024 + 1));
  return new Response('', { status: 404 });
}

/** Zoop as the test host answers: each path gives the replies listed, in turn. */
function zoop(replies: Readonly<Record<string, readonly Reply[]>>, environment: 'test' | 'live' = 'test') {
  const sent: { url: string; headers: Headers; body: { task_id: string; data: Record<string, string> } }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('data:')) return globalThis.fetch(url);
    if (new URL(url).hostname === 'storage.rivr.test') return storage(url, init);
    sent.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    const path = new URL(url).pathname;
    const reply = replies[path]?.[sent.filter((call) => new URL(call.url).pathname === path).length - 1] ?? { status: 404, body: '' };
    const body = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body);
    return new Response(body, { status: reply.status ?? 200 });
  };
  const namesMatch = (document: string, given: string) => document.toLowerCase() === given.toLowerCase();
  return { kyc: createZoopKyc({ appId: 'app-1', apiKey: 'key-1', environment, namesMatch, fetch }), sent };
}

const LITE = '/api/v1/in/identity/pan/lite';
const DEMOGRAPHIC = '/api/v1/in/identity/pan/demographic';
const FACE = '/api/v1/in/ml/face/match';
const VALID_PAN = zoopReply('100', { pan_status: 'Valid', pan_number: 'ABCPV1234D', user_full_name: 'Rahul Gupta' }, 'lite-1');

describe('Zoop KYC: the PAN check', () => {
  it('checks the PAN with Pan Lite, then its date of birth, day first, with Pan Demographic', async () => {
    const { kyc, sent } = zoop({ [LITE]: [{ body: VALID_PAN }], [DEMOGRAPHIC]: [{ body: zoopReply('100', { is_dob_match: true }) }] });
    expect(await kyc.verifyPan({ pan, name: 'rahul gupta', dateOfBirth: '1995-02-08' })).toEqual({
      ok: true, value: { isValid: true, nameMatches: true, dateOfBirthMatches: true, vendorReference: 'lite-1' },
    });
    expect(sent.map((call) => call.body.data)).toEqual([
      expect.objectContaining({ customer_pan_number: 'ABCPV1234D' }),
      expect.objectContaining({ customer_pan_number: 'ABCPV1234D', customer_dob: '08-02-1995' }),
    ]);
  });

  it('sends the keys as headers, the consent and a fresh task id, to the test host or the live one', async () => {
    const { kyc, sent } = zoop({ [LITE]: [{ body: zoopReply('101', null) }] }, 'live');
    await kyc.verifyPan({ pan, name: 'Rahul Gupta', dateOfBirth: '1995-02-08' });
    const [call] = sent;
    expect(call?.url).toBe('https://live.zoop.one/api/v1/in/identity/pan/lite');
    expect([call?.headers.get('app-id'), call?.headers.get('api-key')]).toEqual(['app-1', 'key-1']);
    expect(call?.body.data.consent).toBe('Y');
    expect(call?.body.data.consent_text?.length).toBeGreaterThanOrEqual(20);
    expect(call?.body.task_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(zoop({}).kyc).not.toHaveProperty('checkLiveness');
  });

  it.each([
    ['Zoop has no record of it (101)', zoopReply('101', null)],
    ['it is not valid', zoopReply('100', { pan_status: 'INVALID', user_full_name: 'Rahul Gupta' })],
  ])('is not valid, asking nothing more, when %s', async (_, body) => {
    const { kyc, sent } = zoop({ [LITE]: [{ body }] });
    const checked = await kyc.verifyPan({ pan, name: 'Rahul Gupta', dateOfBirth: '1995-02-08' });
    expect(checked).toMatchObject({ ok: true, value: { isValid: false, nameMatches: false, dateOfBirthMatches: false } });
    expect(sent).toHaveLength(1);
  });

  it('does not ask the date of birth of a PAN in another name', async () => {
    const { kyc, sent } = zoop({ [LITE]: [{ body: VALID_PAN }] });
    const checked = await kyc.verifyPan({ pan, name: 'Rahul Sharma', dateOfBirth: '1995-02-08' });
    expect(checked).toMatchObject({ ok: true, value: { isValid: true, nameMatches: false, dateOfBirthMatches: false } });
    expect(sent).toHaveLength(1);
  });

  it.each([
    ['the date of birth is not the PAN\'s', zoopReply('100', { is_dob_match: false })],
    ['Zoop has no record of the pair (101)', zoopReply('101', null)],
  ])('reads the date of birth as not matching when %s', async (_, body) => {
    const { kyc } = zoop({ [LITE]: [{ body: VALID_PAN }], [DEMOGRAPHIC]: [{ body }] });
    const checked = await kyc.verifyPan({ pan, name: 'Rahul Gupta', dateOfBirth: '1995-02-08' });
    expect(checked).toMatchObject({ ok: true, value: { isValid: true, nameMatches: true, dateOfBirthMatches: false } });
  });

  it('does not give back a try whose date of birth failed after Pan Lite was paid for', async () => {
    const { kyc } = zoop({ [LITE]: [{ body: VALID_PAN }], [DEMOGRAPHIC]: [{ status: 503, body: zoopReply('110', null) }] });
    expect(await kyc.verifyPan({ pan, name: 'Rahul Gupta', dateOfBirth: '1995-02-08' })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'Zoop date of birth unavailable' },
    });
  });

  it('refuses a PAN answer it cannot read, so the paid try is not given back', async () => {
    const { kyc } = zoop({ [LITE]: [{ body: zoopReply('100', { status: 'ok' }) }] });
    expect(await kyc.verifyPan({ pan, name: 'Rahul Gupta', dateOfBirth: '1995-02-08' })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'Zoop unreadable' },
    });
  });
});

describe('Zoop KYC: the face match', () => {
  it('sends the reference as the card and the selfie as the user, in base64 without a prefix, and reads a match', async () => {
    const { kyc, sent } = zoop({ [FACE]: [{ body: SAME_FACE }] });
    expect(await kyc.matchFace({ selfieUrl: SELFIE, referenceUrl: REFERENCE })).toEqual({
      ok: true, value: { isMatch: true, score: 100, vendorReference: '58f904a1' },
    });
    expect(sent[0]?.body.data).toMatchObject({ card_image: '/9j/AA==', user_image: '/9j/4A==' });
  });

  it('reads Zoop\'s 101 as not the same person, with no score', async () => {
    const { kyc } = zoop({ [FACE]: [{ body: NOT_THE_SAME }] });
    expect(await kyc.matchFace({ selfieUrl: SELFIE, referenceUrl: REFERENCE })).toEqual({
      ok: true, value: { isMatch: false, score: 0, vendorReference: '9c835a58' },
    });
  });

  it.each([
    ['is gone', 'https://storage.rivr.test/gone.jpg'],
    ['is over 5 MB', 'https://storage.rivr.test/huge.jpg'],
    ['is on plain http away from this machine', 'http://storage.rivr.test/kyc/selfie.jpg'],
    ['is a file', 'file:///etc/passwd'],
  ])('fails as unavailable, asking Zoop nothing, when an image %s', async (_, selfieUrl) => {
    const { kyc, sent } = zoop({ [FACE]: [{ body: SAME_FACE }] });
    expect(await kyc.matchFace({ selfieUrl, referenceUrl: REFERENCE })).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(sent).toHaveLength(0);
  });

  it('refuses a match it cannot read, as a score that is not a number', async () => {
    const { kyc } = zoop({ [FACE]: [{ body: zoopReply('100', { face_match_score: 'high' }) }] });
    expect(await kyc.matchFace({ selfieUrl: SELFIE, referenceUrl: REFERENCE })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'Zoop unreadable' },
    });
  });
});

describe('Zoop KYC: what fails, and how', () => {
  const memberId = memberIdSchema.parse('3f2b8c4e-9d1a-4b6f-8e2c-7a5d9f0b1c3e');

  it.each([
    ['a refused key', { status: 401, body: { response_code: 401, response_message: 'api key is invalid or disabled' } }, { code: 'rejected', reason: 'Zoop 401' }],
    ['a product not on the account', { status: 403, body: { response_code: 403, response_message: 'product not subscribed by app' } }, { code: 'rejected', reason: 'Zoop 403' }],
    ['a wallet running low', { status: 402, body: zoopReply('112', null) }, { code: 'rejected', reason: 'Zoop 112' }],
    ['an input Zoop refuses', { status: 400, body: zoopReply('106', null) }, { code: 'rejected', reason: 'Zoop 106' }],
    ['more than one record', { body: zoopReply('102', null) }, { code: 'rejected', reason: 'Zoop 102' }],
    ['a code that is not a number', { status: 400, body: zoopReply('<b>bad</b>', null) }, { code: 'rejected', reason: 'Zoop HTTP 400' }],
    ['too many requests', { status: 429, body: '' }, { code: 'rate_limited' }],
    ['its source down', { status: 503, body: zoopReply('110', null) }, { code: 'unavailable' }],
    ['a source error with a 200', { body: zoopReply('108', null) }, { code: 'unavailable' }],
    ['a gateway\'s HTML page', { body: '<html>bad gateway</html>' }, { code: 'unavailable' }],
  ])('%s', async (_, reply, failure) => {
    const { kyc } = zoop({ [LITE]: [reply] });
    expect(await kyc.verifyPan({ pan, name: 'Rahul Gupta', dateOfBirth: '1995-02-08' })).toEqual({ ok: false, error: failure });
  });

  it('fails as unavailable when Zoop cannot be reached', async () => {
    const kyc = createZoopKyc({
      appId: 'app-1', apiKey: 'key-1', environment: 'test', namesMatch: () => true,
      fetch: async () => { throw new TypeError('network down'); },
    });
    expect(await kyc.verifyPan({ pan, name: 'Rahul Gupta', dateOfBirth: '1995-02-08' })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('keeps DigiLocker closed, asking Zoop nothing, until Zoop adds it to the account', async () => {
    const { kyc, sent } = zoop({});
    expect(await kyc.startDigiLocker({ memberId, returnUrl: 'https://app.rivr.test/kyc/return' })).toEqual({ ok: false, error: { code: 'not_configured' } });
    expect(await kyc.pullDigiLocker({ sessionId: 'any' })).toEqual({ ok: false, error: { code: 'not_configured' } });
    expect(sent).toHaveLength(0);
  });
});
