import { describe, expect, it } from 'vitest';
import { attributionFrom, attributionSearch } from './attribution.ts';

describe('attributionFrom', () => {
  it('reads the referral, creator and UTM codes from a link', () => {
    expect(attributionFrom('?ref=FRIEND1&creator=asha_plays&utm_source=instagram&utm_medium=reel&utm_campaign=launch+week')).toEqual({
      referral: 'FRIEND1',
      creator: 'asha_plays',
      utmSource: 'instagram',
      utmMedium: 'reel',
      utmCampaign: 'launch week',
    });
  });

  it('is null for a link with no codes', () => {
    expect(attributionFrom('')).toBeNull();
    expect(attributionFrom('?tab=home')).toBeNull();
  });

  it('writes the codes back as a query string, with nothing else', () => {
    const codes = attributionFrom('?ref=FRIEND1&lead=98765&utm_campaign=launch+week');
    expect(codes && attributionSearch(codes)).toBe('ref=FRIEND1&utm_campaign=launch+week');
  });

  it('drops a malformed code and keeps the rest', () => {
    expect(attributionFrom('?ref=%3Cscript%3E&utm_source=google')).toEqual({ utmSource: 'google' });
    expect(attributionFrom(`?creator=${'x'.repeat(65)}`)).toBeNull();
  });
});
