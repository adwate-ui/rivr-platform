// For the live implementations' tests only: keys made for the run, a JSON Web Token's parts, and a vendor that records
// each request. Nothing here is exported from the package.

/** The armour a PKCS#8 key's PEM has, at its start or end. */
const armour = (edge: 'BEGIN' | 'END'): string => `-----${edge} ${'PRIVATE'} KEY-----`;

function pemOf(der: ArrayBuffer): string {
  let text = '';
  for (const byte of new Uint8Array(der)) text += String.fromCharCode(byte);
  return [armour('BEGIN'), ...(btoa(text).match(/.{1,64}/g) ?? []), armour('END')].join('\n');
}

/** A key pair of the kind Apple's `.p8` holds (P-256) or a Google service account's (RSA): the PEM and the public half. */
export async function testKey(kind: 'apple' | 'google'): Promise<{ pem: string; publicKey: CryptoKey }> {
  const algorithm = kind === 'apple'
    ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  const pair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  return { pem: pemOf(await crypto.subtle.exportKey('pkcs8', pair.privateKey)), publicKey: pair.publicKey };
}

function bytesOf(part: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0));
}

/** A JSON Web Token's header and claims, and whether its signature checks with the public key. */
export async function readJwt(token: string, publicKey: CryptoKey): Promise<{ header: unknown; claims: unknown; isSigned: boolean }> {
  const [header = '', claims = '', signature = ''] = token.split('.');
  const json = (part: string): unknown => JSON.parse(new TextDecoder().decode(bytesOf(part)));
  const algorithm = publicKey.algorithm.name === 'ECDSA' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' };
  const isSigned = await crypto.subtle.verify(algorithm, publicKey, bytesOf(signature), new TextEncoder().encode(`${header}.${claims}`));
  return { header: json(header), claims: json(claims), isSigned };
}

/** A vendor's answer, as JSON. */
export function answer(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

/** One request a fake vendor received. */
export interface Received {
  readonly url: string;
  readonly headers: Headers;
  readonly body: string;
}

/** A fetch that records each request and answers from `answers` in turn (200 `{}` once they run out). */
export function fakeVendor(answers: Response[]): { received: Received[]; fetch: typeof globalThis.fetch } {
  const received: Received[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    received.push({ url: String(input), headers: new Headers(init?.headers), body: String(init?.body ?? '') });
    return answers.shift() ?? answer(200);
  };
  return { received, fetch };
}
