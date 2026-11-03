// JSON Web Tokens signed with a private key, as Apple's push service (ES256, decision 0361) and Google's OAuth for
// Firebase (RS256) take them. Web Crypto only: no Node built-in, no vendor SDK.

const ALGORITHMS = {
  ES256: { key: { name: 'ECDSA', namedCurve: 'P-256' }, sign: { name: 'ECDSA', hash: 'SHA-256' } },
  RS256: { key: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, sign: { name: 'RSASSA-PKCS1-v1_5' } },
} as const;

/** A signing algorithm: Apple's ES256 or Google's RS256. */
export type JwtAlgorithm = keyof typeof ALGORITHMS;

/** A PKCS#8 private key's bytes from its PEM. A key pasted with its breaks lost, or as `\n`, still reads. */
function bytesOfPrivateKey(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replaceAll('\\n', '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

/** Bytes as base64url, unpadded. */
export function base64Url(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function jsonPart(value: object): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * Signs a token: `header` adds to `alg` and `typ` (Apple's key id, `kid`). ECDSA's signature comes as r and s, which is
 * what ES256 takes. Throws when the key cannot be read, which is a configuration bug.
 */
export async function signJwt({ algorithm, privateKey, header = {}, claims }: {
  algorithm: JwtAlgorithm;
  /** The PKCS#8 PEM: Apple's `.p8`, or a Google service account's `private_key`. */
  privateKey: string;
  header?: Readonly<Record<string, string>>;
  claims: Readonly<Record<string, string | number>>;
}): Promise<string> {
  const { key: keyAlgorithm, sign } = ALGORITHMS[algorithm];
  const key = await crypto.subtle.importKey('pkcs8', bytesOfPrivateKey(privateKey), keyAlgorithm, false, ['sign']);
  const unsigned = `${jsonPart({ alg: algorithm, typ: 'JWT', ...header })}.${jsonPart(claims)}`;
  const signature = await crypto.subtle.sign(sign, key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}
