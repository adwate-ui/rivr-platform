/**
 * SHA-256 of `text` as lower-case hex, the form Meta and Google require for identifiers. Uses Web
 * Crypto, which browsers, Deno and Node all provide.
 */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
