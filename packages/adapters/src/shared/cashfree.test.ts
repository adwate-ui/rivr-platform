import { describe, expect, it } from 'vitest';
import { cashfreeFailure, cashfreeSignature, createCashfreeClient } from './cashfree.ts';

// A key pair made for the test, as Cashfree's dashboard makes one: the client gets the public half.
async function makeKeyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-1' }, true, ['encrypt', 'decrypt'],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const body = btoa(String.fromCharCode(...spki)).replace(/(.{64})/g, '$1\n');
  return { pem: `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`, privateKey: pair.privateKey };
}

// One key for the file: making a 2,048-bit RSA key for every case is slow enough to time out on a busy runner.
let keyPairMade: Promise<{ pem: string; privateKey: CryptoKey }> | undefined;
function keyPair(): Promise<{ pem: string; privateKey: CryptoKey }> {
  keyPairMade ??= makeKeyPair();
  return keyPairMade;
}

async function decrypt(privateKey: CryptoKey, signature: string) {
  const bytes = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, bytes));
}

describe('Cashfree client', () => {
  it('signs the client id and the time in seconds with the public key, which Cashfree decrypts', async () => {
    const { pem, privateKey } = await keyPair();
    const signature = await cashfreeSignature('CF123', pem, new Date('2026-10-26T10:00:00Z'));
    expect(await decrypt(privateKey, signature)).toBe('CF123.1793008800');
    // The same key pasted on one line, its breaks lost, signs the same way.
    const oneLine = await cashfreeSignature('CF123', pem.replaceAll('\n', ' '), new Date('2026-10-26T10:00:00Z'));
    expect(await decrypt(privateKey, oneLine)).toBe('CF123.1793008800');
  });

  it('sends the keys, the signature and the API version to the sandbox or production', async () => {
    const { pem, privateKey } = await keyPair();
    const seen: { url: string; headers: Headers; body: unknown }[] = [];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      seen.push({ url: String(input), headers: new Headers(init?.headers), body: init?.body });
      return Response.json({ status: 'VALID' });
    };
    const options = { clientId: 'CF123', clientSecret: 'secret', publicKey: pem, fetch, now: () => new Date('2026-10-26T10:00:00Z') };
    const sandbox = createCashfreeClient({ ...options, environment: 'sandbox' });
    expect(await sandbox.request({ method: 'POST', path: '/verification/pan-lite', json: { pan: 'ABCPV1234D' } }))
      .toEqual({ ok: true, value: { status: 'VALID' } });
    await createCashfreeClient({ ...options, environment: 'production' })
      .request({ method: 'POST', path: '/verification/face-liveness', form: new FormData(), apiVersion: '2024-12-01' });

    expect(seen.map((call) => call.url)).toEqual([
      'https://sandbox.cashfree.com/verification/pan-lite', 'https://api.cashfree.com/verification/face-liveness',
    ]);
    const [json, form] = seen;
    expect(json?.headers.get('x-client-id')).toBe('CF123');
    expect(json?.headers.get('x-client-secret')).toBe('secret');
    expect(await decrypt(privateKey, json?.headers.get('x-cf-signature') ?? '')).toBe('CF123.1793008800');
    expect(json?.headers.get('content-type')).toBe('application/json');
    expect(json?.body).toBe('{"pan":"ABCPV1234D"}');
    expect(form?.headers.get('x-api-version')).toBe('2024-12-01');
    expect(form?.headers.get('content-type')).toBeNull();
  });

  it('reads a refusal by its status and Cashfree code, never its message', async () => {
    expect(cashfreeFailure(429, {})).toEqual({ code: 'rate_limited' });
    expect(cashfreeFailure(502, undefined)).toEqual({ code: 'unavailable' });
    expect(cashfreeFailure(403, { code: 'ip_validation_failed', message: 'IP not whitelisted. Your current ip is 203.0.113.9.' }))
      .toEqual({ code: 'rejected', reason: 'Cashfree ip_validation_failed' });
    expect(cashfreeFailure(400, undefined)).toEqual({ code: 'rejected', reason: 'Cashfree HTTP 400' });
  });

  it('is unavailable, without calling, when the public key cannot be read', async () => {
    let calls = 0;
    const fetch: typeof globalThis.fetch = async () => { calls += 1; return Response.json({}); };
    const client = createCashfreeClient({ clientId: 'CF1', clientSecret: 's', publicKey: 'not a key', environment: 'sandbox', fetch });
    expect(await client.request({ method: 'GET', path: '/payout/transfers' })).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(calls).toBe(0);
  });

  it('gives up on no answer as unavailable', async () => {
    const { pem } = await keyPair();
    const fetch: typeof globalThis.fetch = async () => { throw new TypeError('network down'); };
    const client = createCashfreeClient({ clientId: 'CF123', clientSecret: 's', publicKey: pem, environment: 'sandbox', fetch });
    expect(await client.request({ method: 'GET', path: '/payout/transfers' })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
