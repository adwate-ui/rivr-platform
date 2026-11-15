import { describe, expect, it } from 'vitest';
import { failureCodeOf, readFailureCode, refusalCodeOf } from './failureCode.ts';

describe('failureCodeOf', () => {
  it('keeps a word the code gave the failure', () => {
    expect(failureCodeOf('not_live')).toBe('not_live');
    expect(failureCodeOf('PGRST116')).toBe('PGRST116');
  });

  it('writes a database code two digits at a time, so the number rule leaves it readable', () => {
    expect(failureCodeOf({ message: 'permission denied for table member', code: '42501' })).toBe('42x501');
  });

  it('reads the code of a database or Auth error, else the name of an error', () => {
    expect(failureCodeOf({ code: 'over_request_rate_limit', message: 'For security purposes, wait 37 seconds' })).toBe('over_request_rate_limit');
    expect(failureCodeOf(new TypeError('Failed to fetch'))).toBe('TypeError');
  });

  it.each([
    ['a phone number', '9876543210'],
    ['a sign-in code', '123456'],
    ['a sentence', 'Asha Verma could not sign up'],
    ['an email address', 'asha.verma@example.com'],
    ['a long run of letters', 'a'.repeat(41)],
    ['an error whose name is a sentence', Object.assign(new Error('x'), { name: 'Asha Verma' })],
    ['nothing', undefined],
    ['a number', 9876543210],
  ])('gives unknown for %s, which could be a typed value', (_what, failure) => {
    expect(failureCodeOf(failure)).toBe('unknown');
  });
});

describe('readFailureCode', () => {
  it('names what was read and why it failed, never the ids in the query key', () => {
    const key = ['user', '00000000-0000-4000-8000-000000000211', 'member'];
    expect(readFailureCode(key, { code: '42501' })).toBe('read:member:42x501');
    expect(readFailureCode(['club-contact'], new TypeError('Failed to fetch'))).toBe('read:club-contact:TypeError');
    expect(readFailureCode([{ phone: '9876543210' }], new Error('x'))).toBe('read:unknown:Error');
  });
});

describe('refusalCodeOf', () => {
  it('gives a refusal its code, and nothing for any other answer', () => {
    expect(refusalCodeOf({ ok: false, error: 'not_live' })).toBe('refused:not_live');
    expect(refusalCodeOf({ ok: false, error: { code: 'rejected' } })).toBe('refused:rejected');
    expect(refusalCodeOf({ ok: false, error: '+91 98765 43210' })).toBe('refused:unknown');
    expect(refusalCodeOf({ ok: true, value: null })).toBeNull();
    expect(refusalCodeOf(null)).toBeNull();
    expect(refusalCodeOf('done')).toBeNull();
  });
});
