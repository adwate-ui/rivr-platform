/** A device's session, as device-pair returns it (#41). */
export interface DeviceSession {
  readonly access_token: string;
  readonly refresh_token: string;
}

/**
 * The session in device-pair's reply, or null when the reply is not one. Read by hand rather than
 * with a schema, so @rivr/db's main entry carries no Zod into the player app's bundle.
 */
export function toDeviceSession(reply: unknown): DeviceSession | null {
  const field = (name: string): unknown => (typeof reply === 'object' && reply !== null ? Reflect.get(reply, name) : undefined);
  const accessToken = field('access_token');
  const refreshToken = field('refresh_token');
  if (typeof accessToken !== 'string' || accessToken === '' || typeof refreshToken !== 'string' || refreshToken === '') return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}
