import { afterEach, describe, expect, it } from 'vitest';
import { forgetAttribution, rememberAttribution, storedAttribution } from './attribution.ts';

const OCT_17 = new Date('2026-10-17T10:00:00.000Z');

afterEach(() => localStorage.clear());

describe('attribution kept until sign-up', () => {
  it('keeps the codes of the first link with codes', () => {
    rememberAttribution('?ref=FRIEND1&utm_source=instagram', OCT_17);
    rememberAttribution('?ref=LATER', OCT_17);

    expect(storedAttribution(OCT_17)).toEqual({ referral: 'FRIEND1', utmSource: 'instagram', firstSeenAt: '2026-10-17T10:00:00.000Z' });
  });

  it('ignores a link without codes', () => {
    rememberAttribution('?tab=home', OCT_17);
    expect(storedAttribution(OCT_17)).toBeNull();
  });

  it('lets codes older than 30 days go, so a newer link counts', () => {
    rememberAttribution('?ref=OLD', OCT_17);
    const later = new Date('2026-11-20T10:00:00.000Z');

    expect(storedAttribution(later)).toBeNull();
    rememberAttribution('?ref=NEW', later);
    expect(storedAttribution(later)).toMatchObject({ referral: 'NEW' });
  });

  it('forgets them once a sign-up carried them', () => {
    rememberAttribution('?ref=FRIEND1', OCT_17);
    forgetAttribution();
    expect(storedAttribution(OCT_17)).toBeNull();
  });
});
