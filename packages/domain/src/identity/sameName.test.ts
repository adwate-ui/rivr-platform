import { describe, expect, it } from 'vitest';
import { isSameName } from './sameName.ts';

describe('isSameName', () => {
  it('ignores case, spacing and punctuation', () => {
    expect(isSameName('ARJUN  MEHTA', 'Arjun Mehta')).toBe(true);
    expect(isSameName(" Rhea D'Souza ", 'Rhea DSouza')).toBe(true);
  });

  it('tells different people apart', () => {
    expect(isSameName('Kabir Sethi', 'Arjun Mehta')).toBe(false);
    expect(isSameName('Arjun Mehta', 'Arjun Mehra')).toBe(false);
  });

  it('keeps Devanagari vowel signs, so राम is not रमा', () => {
    expect(isSameName('राम', 'रमा')).toBe(false);
    expect(isSameName('सीता', 'सत')).toBe(false);
    expect(isSameName('राम', 'राम')).toBe(true);
  });

  it('matches nothing to a name with no letters', () => {
    expect(isSameName('', '')).toBe(false);
    expect(isSameName('...', '')).toBe(false);
  });
});
