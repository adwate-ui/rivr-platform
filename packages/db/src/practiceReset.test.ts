import { describe, expect, it } from 'vitest';
import { practiceResetFailureOf } from './practiceReset.ts';

describe('practiceResetFailureOf', () => {
  it('says why a reset to seed was refused', () => {
    expect(practiceResetFailureOf({ code: '42501' })).toBe('not_allowed');
    expect(practiceResetFailureOf({ code: 'RVPRA' })).toBe('not_practice');
    expect(practiceResetFailureOf({ code: 'RVSED' })).toBe('no_seed');
    expect(practiceResetFailureOf({ code: 'RVNAM' })).toBe('wrong_name');
    expect(practiceResetFailureOf({ code: 'RVFRZ' })).toBe('paused');
    expect(practiceResetFailureOf({ code: '55P03' })).toBe('busy');
  });

  it('calls anything else unavailable', () => {
    expect(practiceResetFailureOf({ code: 'XX000' })).toBe('unavailable');
  });
});
