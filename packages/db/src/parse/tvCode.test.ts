import { describe, expect, it } from 'vitest';
import { toTvCode } from './tvCode.ts';

describe('toTvCode', () => {
  const reply = { code: '048213', secret: 'a'.repeat(64), expires_at: '2026-10-19T21:45:00+05:30' };

  it('reads the code, the secret and when the code runs out', () => {
    expect(toTvCode(reply)).toEqual({ code: '048213', secret: 'a'.repeat(64), expiresAt: '2026-10-19T21:45:00+05:30' });
  });

  it('is null for anything that is not a whole reply', () => {
    expect(toTvCode(null)).toBeNull();
    expect(toTvCode({ ...reply, code: '48213' })).toBeNull();
    expect(toTvCode({ ...reply, secret: '' })).toBeNull();
    expect(toTvCode({ ...reply, expires_at: 'soon' })).toBeNull();
    expect(toTvCode({ waiting: true })).toBeNull();
  });
});
