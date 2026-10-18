import { describe, expect, it } from 'vitest';
import { t } from './translate.ts';

describe('t', () => {
  it('returns the message for the key', () => {
    expect(t('common.retry')).toBe('Try again');
  });

  it('fills placeholders from params', () => {
    expect(t('common.featureLocked', { tiers: 'Black card' })).toBe('Black card only.');
  });

  it('leaves a placeholder visible when its value is missing, so the gap is noticed', () => {
    expect(t('common.featureLocked')).toBe('{tiers} only.');
  });
});
