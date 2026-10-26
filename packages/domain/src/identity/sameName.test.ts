import { describe, expect, it } from 'vitest';
import { isSameName, kycIdentityKey } from './sameName.ts';

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

describe('kycIdentityKey', () => {
  it('is the name as the name match reads it, the date of birth and the last four digits', () => {
    expect(kycIdentityKey(' RAHUL  SHARMA ', '1995-02-02', 'XXXX XXXX 5647')).toBe('rahul sharma|1995-02-02|5647');
  });

  it('is one key for one person however the name is punctuated, so a full stop dodges nothing', () => {
    const key = kycIdentityKey('Rahul Sharma', '1995-02-02', 'XXXX XXXX 5647');
    expect(kycIdentityKey('Rahul Sharma.', '1995-02-02', 'XXXX XXXX 5647')).toBe(key);
    expect(kycIdentityKey('Rahul-Sharma', '1995-02-02', 'XXXX XXXX 5647')).not.toBe(key);
    expect(kycIdentityKey("Rahul Sharma's", '1995-02-02', 'xxxxxxxx5647')).toBe('rahul sharmas|1995-02-02|5647');
  });

  it('tells apart another date of birth or other last four digits', () => {
    const key = kycIdentityKey('Rahul Sharma', '1995-02-02', 'XXXX XXXX 5647');
    expect(kycIdentityKey('Rahul Sharma', '1995-02-03', 'XXXX XXXX 5647')).not.toBe(key);
    expect(kycIdentityKey('Rahul Sharma', '1995-02-02', 'XXXX XXXX 5648')).not.toBe(key);
  });

  it('is none without a name in letters or four digits at the end', () => {
    expect(kycIdentityKey('...', '1995-02-02', 'XXXX XXXX 5647')).toBeNull();
    expect(kycIdentityKey('Rahul Sharma', '1995-02-02', 'XXXX XXXX')).toBeNull();
    expect(kycIdentityKey('Rahul Sharma', '1995-02-02', 'XXXX XXXX 564')).toBeNull();
  });
});
