import { describe, expect, it } from 'vitest';
import { returnPathFrom, returnSearchFrom } from './returnPath.ts';

describe('returnPathFrom', () => {
  it('keeps a path in the app, a booking id included', () => {
    expect(returnPathFrom('/academy')).toBe('/academy');
    expect(returnPathFrom('/academy/0b7e4f3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b')).toBe('/academy/0b7e4f3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b');
    expect(returnPathFrom('/profile/limits')).toBe('/profile/limits');
  });

  it('never an address that leaves the app', () => {
    for (const outside of ['//evil.example', 'https://evil.example', '/\\evil.example', 'evil.example', '/academy?x=1', '/academy#x', '/%2F%2Fevil', ' /academy']) {
      expect(returnPathFrom(outside)).toBeNull();
    }
  });

  it('answers at once for a crafted path built to make the check slow', () => {
    const started = performance.now();
    expect(returnPathFrom(`/${'a'.repeat(150)}!`)).toBeNull();
    expect(returnPathFrom(`/academy/${'a1-'.repeat(60)}!`)).toBeNull();
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('nor sign-in or sign-up themselves', () => {
    expect(returnPathFrom('/sign-in')).toBeNull();
    expect(returnPathFrom('/sign-up/')).toBeNull();
    expect(returnPathFrom('/Sign-In')).toBeNull();
    expect(returnPathFrom('/sign-inside')).toBe('/sign-inside');
  });

  it('nor anything that is not a path', () => {
    expect(returnPathFrom(undefined)).toBeNull();
    expect(returnPathFrom(42)).toBeNull();
    expect(returnPathFrom(`/${'a'.repeat(200)}`)).toBeNull();
  });
});

describe('returnSearchFrom', () => {
  it('keeps next only when it is a path in the app, and replaces anything else', () => {
    expect(returnSearchFrom({ next: '/academy' })).toEqual({ next: '/academy' });
    const outside = returnSearchFrom({ next: '//evil.example' });
    expect(Object.keys(outside)).toEqual(['next']);
    expect(outside.next).toBeUndefined();
  });
});
