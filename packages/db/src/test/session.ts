/** The key tests store the session under; pass it to createClient as `auth.storageKey`. */
export const TEST_SESSION_KEY = 'rivr-test-auth';

/** Browser storage holding a signed-in session for `userId` (expiring at `expiresAt`), or nothing when signed out. */
export function sessionStorageFor(userId: string | null, expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  const items = new Map<string, string>();
  if (userId !== null) {
    const session = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      user: { id: userId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    };
    items.set(TEST_SESSION_KEY, JSON.stringify(session));
  }
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}
