import { describe, expect, it } from 'vitest';
import { createFakeEmail, createResendEmail, fencedEmail, RESEND_EMAILS_URL } from './index.ts';

// The live adapter against a fake fetch: what it sends Resend and how it reads each reply; and staging's fence.

/** A fetch that records each request and answers with `status` and `body`. */
function fakeFetch(status: number, body: unknown) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, requests };
}

const resend = (fetch: typeof globalThis.fetch) => createResendEmail({ apiKey: 'test-key', from: 'RIVR alerts <alerts@example.com>', fetch });
const MESSAGE = { to: ['owner@example.com'], subject: 'RIVR alert: a test', text: 'A test.' };

describe('Resend', () => {
  it('posts the message from the club\'s address with the key as a bearer, and reads back the message id', async () => {
    const { fetch, requests } = fakeFetch(200, { id: 'msg_1' });
    expect(await resend(fetch).send(MESSAGE)).toEqual({ ok: true, value: { messageId: 'msg_1' } });
    expect(requests[0]?.url).toBe(RESEND_EMAILS_URL);
    expect(requests[0]?.init.headers).toEqual({ authorization: 'Bearer test-key', 'content-type': 'application/json' });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({ from: 'RIVR alerts <alerts@example.com>', ...MESSAGE });
  });

  it('reads a limit as rate limited, a fault on its side as unavailable, and anything else as refused', async () => {
    expect(await resend(fakeFetch(429, {}).fetch).send(MESSAGE)).toEqual({ ok: false, error: { code: 'rate_limited' } });
    expect(await resend(fakeFetch(503, {}).fetch).send(MESSAGE)).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await resend(fakeFetch(422, { message: 'bad from' }).fetch).send(MESSAGE))
      .toEqual({ ok: false, error: { code: 'rejected', reason: 'Resend refused (HTTP 422)' } });
  });

  it('reads no answer as unavailable', async () => {
    const down: typeof globalThis.fetch = async () => { throw new TypeError('network'); };
    expect(await resend(down).send(MESSAGE)).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});

describe('staging\'s fence', () => {
  it('sends only to the listed addresses, and refuses unsent when none is listed', async () => {
    const email = createFakeEmail();
    const fenced = fencedEmail(email, ' Owner@Example.com , ');
    await fenced.send({ ...MESSAGE, to: ['owner@example.com', 'stranger@example.com'] });
    expect(email.calls).toEqual([{ ...MESSAGE, to: ['owner@example.com'] }]);
    expect(await fenced.send({ ...MESSAGE, to: ['stranger@example.com'] })).toEqual({ ok: false, error: { code: 'rejected', reason: 'not on the allowlist' } });
    expect(email.calls).toHaveLength(1);
  });

  it('lets everything through with no list, as in production', () => {
    const email = createFakeEmail();
    expect(fencedEmail(email, '')).toBe(email);
  });
});
