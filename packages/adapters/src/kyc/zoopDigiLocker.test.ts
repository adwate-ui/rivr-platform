import { memberIdSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createZoopKyc } from './zoop.ts';

// Zoop's DigiLocker as its documentation and a test-host run (16 Nov 2026) have it, with made-up people: the run's
// structure, never its values.
const SESSION = '65f0a1b2c3d4e5f6a7b8c9d0';
// Plainly not a real key: secret scanning flags a random-looking one.
const KEY = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const memberId = memberIdSchema.parse('00000000-0000-4000-8000-000000000262');
const RETURN_URL = 'https://player.rivr.test/kyc/return';
const DELIVERY_URL = 'https://db.rivr.test/functions/v1/kyc-digilocker';

interface Reply {
  readonly status?: number;
  readonly body: unknown;
}

/** Zoop by path: a reply, or `offline` for one that never comes. */
function zoop(replies: Readonly<Record<string, Reply | 'offline'>>) {
  const sent: { url: string; method: string; headers: Headers; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    sent.push({ url, method: init?.method ?? 'GET', headers: new Headers(init?.headers), body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
    const reply = replies[new URL(url).pathname];
    if (reply === 'offline') throw new TypeError('offline');
    if (reply === undefined) return new Response('', { status: 404 });
    return new Response(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body), { status: reply.status ?? 200 });
  };
  return { kyc: createZoopKyc({ appId: 'app-1', apiKey: 'key-1', environment: 'test', namesMatch: () => true, fetch }), sent };
}

const INIT = '/identity/digilocker/v1/init';
const FETCH = `/identity/digilocker/v1/fetch/${SESSION}`;
const started = { request_id: SESSION, success: true, webhook_security_key: KEY, sdk_url: `https://gateway.zoop.plus/digilocker/v1/start/${SESSION}`, expires_at: '' };

describe('Zoop DigiLocker: the hand-off', () => {
  it('asks for the Aadhaar and PAN, the documents to the webhook and the member back by a GET, and gives the gateway and key', async () => {
    const { kyc, sent } = zoop({ [INIT]: { body: started } });
    const session = await kyc.startDigiLocker({ memberId, returnUrl: RETURN_URL, deliveryUrl: DELIVERY_URL });
    expect(session).toEqual({
      ok: true,
      value: { sessionId: SESSION, redirectUrl: `https://gateway.zoop.plus/digilocker/v1/start/${SESSION}?mode=REDIRECT`, deliveryKey: KEY },
    });
    expect(sent[0]?.url).toBe(`https://test.zoop.one${INIT}`);
    expect(sent[0]?.headers.get('app-id')).toBe('app-1');
    expect(sent[0]?.headers.get('api-key')).toBe('key-1');
    expect(sent[0]?.body).toEqual({
      docs: ['ADHAR', 'PANCR'], purpose: 'Identity check for RIVR club membership', response_url: DELIVERY_URL, redirect_url: RETURN_URL,
      mode: 'REDIRECT', redirect_method: 'GET',
    });
  });

  it.each([
    ['a key Zoop refuses', { status: 401, body: { response_code: 401, response_message: 'Unauthorized' } }, { code: 'rejected', reason: 'Zoop 401', cause: 'account' }],
    ['DigiLocker off the app', { status: 403, body: { response_code: '403', response_message: 'product not subscribed by app' } }, { code: 'rejected', reason: 'Zoop 403', cause: 'account' }],
    ['a request it refuses', { status: 400, body: { success: false, response_code: '106', metadata: { billable: 'N' } } }, { code: 'rejected', reason: 'Zoop 106' }],
    ['its own trouble', { status: 502, body: 'Bad gateway' }, { code: 'unavailable' }],
    ['a 200 that is not its envelope', { body: 'not json' }, { code: 'unavailable' }],
    ['a gateway that is not https', { body: { ...started, sdk_url: 'http://gateway.zoop.plus/x' } }, { code: 'unavailable' }],
    ['a gateway that is not Zoop\'s', { body: { ...started, sdk_url: 'https://gateway.zoop.plus.example.com/x' } }, { code: 'unavailable' }],
  ])('fails on %s', async (_case, reply, failure) => {
    const { kyc } = zoop({ [INIT]: reply });
    expect(await kyc.startDigiLocker({ memberId, returnUrl: RETURN_URL, deliveryUrl: DELIVERY_URL })).toEqual({ ok: false, error: failure });
  });

  it('is unavailable when Zoop cannot be reached', async () => {
    const { kyc } = zoop({ [INIT]: 'offline' });
    expect(await kyc.startDigiLocker({ memberId, returnUrl: RETURN_URL, deliveryUrl: DELIVERY_URL })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});

describe('Zoop DigiLocker: where the session stands', () => {
  it.each(['INITIATED', 'SUCCESS'])('waits for the webhook while it is %s, asking by a GET with no body', async (state) => {
    const { kyc, sent } = zoop({ [FETCH]: { body: { id: SESSION, transaction_status: state, webhook_sent: 'N', issued_docs: [], pending_docs: [] } } });
    expect(await kyc.pullDigiLocker({ sessionId: SESSION })).toEqual({ ok: true, value: 'waiting' });
    expect(sent[0]).toMatchObject({ method: 'GET', body: undefined });
  });

  it.each([
    ['a session that failed', { body: { transaction_status: 'FAILED' } }, { code: 'rejected', reason: 'Zoop FAILED' }],
    ['a consent refused', { status: 400, body: { success: false, response_code: '104' } }, { code: 'rejected', reason: 'Zoop 104' }],
    ['a status of other words', { body: { transaction_status: 'gone <b>' } }, { code: 'rejected', reason: 'Zoop refused' }],
  ])('refuses %s', async (_case, reply, failure) => {
    const { kyc } = zoop({ [FETCH]: reply });
    expect(await kyc.pullDigiLocker({ sessionId: SESSION })).toEqual({ ok: false, error: failure });
  });

  it('never puts a session id that is not Zoop\'s into a path', async () => {
    const { kyc, sent } = zoop({});
    expect(await kyc.pullDigiLocker({ sessionId: '../../api/v1/x' })).toEqual({ ok: false, error: { code: 'rejected', reason: 'Zoop unknown session' } });
    expect(sent).toHaveLength(0);
  });
});

const PHOTO = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/';

/** DigiLocker's Aadhaar XML in the run's structure, with a made-up person. */
function aadhaarXml({ uid = 'xxxxxxxx4321', name = 'Asha Rani Verma', dob = '07-03-1991', photo = PHOTO } = {}): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Certificate><CertificateData>'
    + '<KycRes code="0f1e2d3c" ret="Y" ts="2026-11-16T15:58:01.000+05:30" ttl="2027-11-16T15:58:01" txn="UKC:0f1e2d3c">'
    + `<UidData tkn="" uid="${uid}"><Poi dob="${dob}" gender="F" name="${name}"/>`
    + '<Poa co="D/O: Ram Verma" country="India" dist="Gurugram" house="Flat 12, Tower B" lm="near the park" loc="Sector 65" pc="122102" '
    + 'po="Badshahpur" state="Haryana" street="Golf Course Extension Road" subdist="Gurugram" vtc="Gurugram"/>'
    + `<LData lang="06" name="" pc="122102"/><Pht>${photo}</Pht></UidData></KycRes></CertificateData>`
    + '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo/><SignatureValue>c2ln</SignatureValue></Signature></Certificate>';
}

/** DigiLocker's PAN Verification Record in the run's structure. */
const panXml = (pan = 'ABCPV1234D') => '<?xml version="1.0" encoding="UTF-8"?>'
  + `<Certificate language="99" name="PAN Verification Record" type="PANCR" number="${pan}" issuedAt="Income Tax" issueDate="" status="A">`
  + '<IssuedBy><Organization name="Income Tax Department" type="CG"/></IssuedBy><IssuedTo>'
  + '<Person uid="0f1e2d3c4b5a69788796a5b4c3d2e1f0" name="ASHA RANI VERMA" dob="07-03-1991" gender="FEMALE"><Photo format=""/></Person>'
  + `</IssuedTo><CertificateData><PAN num="${pan}" verifiedOn="16-11-2026 15:58:01"/></CertificateData></Certificate>`;

const fetched = (doctype: string, xml: string) => ({ issued: { doctype }, doctype, status: 'FETCHED', fetched_at: '', data_xml: xml, data_pdf: 'JVBERi0=', data_json: {} });
const skipped = (doctype: string) => ({ doctype, status: 'SKIPPED' });
const delivery = (result: unknown[], extra: object = {}) => ({
  request_id: SESSION, success: true, response_code: '100', response_message: 'Transaction Successful', metadata: { billable: 'Y' }, result, ...extra,
});
const read = (body: unknown) => zoop({}).kyc.readDigiLockerDelivery(body);

describe('Zoop DigiLocker: the webhook\'s delivery', () => {
  it('reads the record from the Aadhaar, with the PAN that came with it', () => {
    expect(read(delivery([fetched('ADHAR', aadhaarXml()), fetched('PANCR', panXml())]))).toEqual({
      ok: true,
      value: {
        sessionId: SESSION,
        outcome: {
          ok: true,
          value: {
            name: 'Asha Rani Verma', dateOfBirth: '1991-03-07', maskedAadhaar: 'XXXX XXXX 4321', aadhaarReference: null, pan: 'ABCPV1234D',
            address: 'Flat 12, Tower B, Golf Course Extension Road, near the park, Sector 65, Gurugram, Badshahpur, Haryana, 122102',
            photoUrl: `data:image/jpeg;base64,${PHOTO}`, vendorReference: SESSION,
          },
        },
      },
    });
  });

  it('has no PAN when DigiLocker held none, and no date of birth from a year alone', () => {
    const outcome = read(delivery([fetched('ADHAR', aadhaarXml({ dob: '1991' })), skipped('PANCR')]));
    expect(outcome).toMatchObject({ ok: true, value: { outcome: { ok: true, value: { pan: null, dateOfBirth: null } } } });
  });

  it('takes a document skipped with its XML as null', () => {
    const outcome = read(delivery([fetched('ADHAR', aadhaarXml()), { doctype: 'PANCR', status: 'SKIPPED', data_xml: null }], { metadata: { reason_code: null } }));
    expect(outcome).toMatchObject({ ok: true, value: { outcome: { ok: true, value: { pan: null, maskedAadhaar: 'XXXX XXXX 4321' } } } });
  });

  it('reads XML\'s escapes in a name', () => {
    const outcome = read(delivery([fetched('ADHAR', aadhaarXml({ name: 'Anna D&apos;Souza &amp; Co' }))]));
    expect(outcome).toMatchObject({ ok: true, value: { outcome: { ok: true, value: { name: "Anna D'Souza & Co" } } } });
  });

  it.each([
    ['a refused consent, by its reason code', delivery([], { success: false, response_code: '104', metadata: { reason_code: 'CSD' }, result: null }), 'Zoop CSD'],
    ['a reason code of other words', delivery([], { success: false, response_code: '106', metadata: { reason_code: 'a b <c>' } }), 'Zoop refused'],
    ['a reason code that is a long number', delivery([], { success: false, response_code: '106', metadata: { reason_code: '123456784321' } }), 'Zoop refused'],
    ['a refusal with no reason code', delivery([], { success: false, response_code: '106', metadata: { reason_code: null } }), 'Zoop 106'],
    ['no Aadhaar shared', delivery([skipped('ADHAR'), fetched('PANCR', panXml())]), 'Zoop no Aadhaar'],
    ['an Aadhaar with no photo', delivery([fetched('ADHAR', aadhaarXml({ photo: '' }))]), 'Zoop unreadable Aadhaar'],
    ['a photo that is not a JPEG', delivery([fetched('ADHAR', aadhaarXml({ photo: 'iVBORw0KGgo=' }))]), 'Zoop unreadable Aadhaar'],
    ['an Aadhaar number unmasked', delivery([fetched('ADHAR', aadhaarXml({ uid: '123456784321' }))]), 'Zoop unreadable Aadhaar'],
    ['an Aadhaar with no name', delivery([fetched('ADHAR', aadhaarXml({ name: ' ' }))]), 'Zoop unreadable Aadhaar'],
  ])('keeps why not for %s', (_case, body, reason) => {
    expect(read(body)).toEqual({ ok: true, value: { sessionId: SESSION, outcome: { ok: false, error: { code: 'rejected', reason } } } });
  });

  it.each([
    ['no session', { success: true, result: [] }],
    ['a session id that is not Zoop\'s', delivery([], { request_id: '../x' })],
    ['nothing', null],
  ])('is no delivery with %s', (_case, body) => {
    expect(read(body)).toEqual({ ok: false, error: { code: 'rejected', reason: 'Zoop unreadable' } });
  });
});
