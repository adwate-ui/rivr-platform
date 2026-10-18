import { describe, expect, it } from 'vitest';
import { createTranslator } from './translate.ts';

describe('createTranslator', () => {
  it('returns the message for the locale', () => {
    expect(createTranslator('en')('common.retry')).toBe('Try again');
    expect(createTranslator('hi')('common.retry')).toBe('फिर से कोशिश करें');
  });

  it('fills placeholders from params', () => {
    expect(createTranslator('en')('common.featureLocked', { tiers: 'Black card' })).toBe('Black card only.');
  });

  it('leaves a placeholder visible when its value is missing, so the gap is noticed', () => {
    expect(createTranslator('en')('common.featureLocked')).toBe('{tiers} only.');
  });
});
