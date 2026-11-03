import { describe, expect, it } from 'vitest';
import { kycIdentityKey } from './identityKey.ts';

describe('kycIdentityKey', () => {
  it('is the name in plain letters, the date of birth and the last four digits', () => {
    expect(kycIdentityKey(' RAHUL  SHARMA ', '1995-02-02', 'XXXX XXXX 5647')).toBe('rahul sharma|1995-02-02|5647');
  });

  it('is one key for one person however the name is punctuated, so a full stop dodges nothing', () => {
    const key = kycIdentityKey('Rahul Sharma', '1995-02-02', 'XXXX XXXX 5647');
    expect(kycIdentityKey('Rahul Sharma.', '1995-02-02', 'XXXX XXXX 5647')).toBe(key);
    expect(kycIdentityKey('Rahul-Sharma', '1995-02-02', 'XXXX XXXX 5647')).not.toBe(key);
    expect(kycIdentityKey("Rahul Sharma's", '1995-02-02', 'xxxxxxxx5647')).toBe('rahul sharmas|1995-02-02|5647');
  });

  it('keeps Devanagari vowel signs, so राम is not रमा', () => {
    expect(kycIdentityKey('राम', '1995-02-02', 'XXXX XXXX 5647')).toBe('राम|1995-02-02|5647');
    expect(kycIdentityKey('रमा', '1995-02-02', 'XXXX XXXX 5647')).not.toBe(kycIdentityKey('राम', '1995-02-02', 'XXXX XXXX 5647'));
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
