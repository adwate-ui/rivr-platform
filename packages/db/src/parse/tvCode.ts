/** A code for an unpaired TV to show (#49), as device-pair returns it. */
export interface TvCode {
  readonly code: string;
  /** What the TV asks device-pair with until staff type the code in. Held in memory only. */
  readonly secret: string;
  /** When the code runs out and the TV asks for a new one. */
  readonly expiresAt: string;
}

/**
 * The code in device-pair's reply, or null when the reply is not one. Read by hand rather than
 * with a schema, so @rivr/db's main entry carries no Zod into the player app's bundle.
 */
export function toTvCode(reply: unknown): TvCode | null {
  const field = (name: string): unknown => (typeof reply === 'object' && reply !== null ? Reflect.get(reply, name) : undefined);
  const code = field('code');
  const secret = field('secret');
  const expiresAt = field('expires_at');
  if (typeof code !== 'string' || !/^\d{6}$/.test(code) || typeof secret !== 'string' || secret === '') return null;
  if (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) return null;
  return { code, secret, expiresAt };
}
