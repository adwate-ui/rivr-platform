import { describe, expect, it } from 'vitest';
import { toDeviceSession } from './deviceSession.ts';

describe('toDeviceSession', () => {
  it('reads the tokens device-pair returns', () => {
    expect(toDeviceSession({ access_token: 'a', refresh_token: 'r', extra: 1 })).toEqual({ access_token: 'a', refresh_token: 'r' });
  });

  it('is null for anything that is not a session', () => {
    expect(toDeviceSession(null)).toBeNull();
    expect(toDeviceSession({ access_token: 'a' })).toBeNull();
    expect(toDeviceSession({ access_token: '', refresh_token: 'r' })).toBeNull();
    expect(toDeviceSession({ error: 'wrong_code' })).toBeNull();
  });
});
