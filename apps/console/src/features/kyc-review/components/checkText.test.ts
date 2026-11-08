import type { KycCheck } from '@rivr/db';
import { formatDate, formatTime } from '@rivr/i18n';
import { describe, expect, it } from 'vitest';
import { checkDetails, checkGroups, mayReopen, queueLine, sinceText } from './checkText.ts';

const REFUSED: KycCheck = {
  memberId: 'm1', fullName: 'Asha Rao', status: 'refused', method: 'manual', waitingBecause: null, dateOfBirth: null, maskedAadhaar: null,
  pan: null, address: null, photoPath: null, livenessScore: null, faceMatchScore: null, vendorReference: null, refusal: 'duplicate_pan',
  clashesWith: [], updatedAt: '2026-11-01T10:00:00Z',
};

describe('checkDetails', () => {
  it('leaves out every detail a check waiting on the member does not hold, keeping how it was made', () => {
    expect(checkDetails({ ...REFUSED, status: 'needs_pan', method: 'digilocker', refusal: null })).toEqual([{ label: 'Method', value: 'DigiLocker' }]);
  });

  it('says a missing date of birth is not kept while a reviewer must enter it, and shows the scores the vendor gave', () => {
    const check: KycCheck = { ...REFUSED, status: 'needs_review', method: 'digilocker', refusal: null, pan: 'ABCPR4444R', livenessScore: 91 };
    expect(checkDetails(check)).toEqual([
      { label: 'Date of birth', value: 'Not kept. Check the original document.' },
      { label: 'PAN', value: 'ABCPR4444R' },
      { label: 'DigiLocker', value: 'Liveness 91, face match None' },
    ]);
  });
});

describe('checkGroups', () => {
  it('puts checks waiting on the member apart from those to review and those refused', () => {
    const groups = checkGroups([
      { ...REFUSED, memberId: 'review', status: 'needs_review', refusal: null },
      { ...REFUSED, memberId: 'pan', status: 'needs_pan', refusal: null },
      REFUSED,
    ]);
    expect([groups.toReview, groups.onMember, groups.refused].map((group) => group.map((check) => check.memberId))).toEqual([['review'], ['pan'], ['m1']]);
  });

  it('puts the longest waiting first, so a check held for weeks heads its group (audit F-092)', () => {
    const groups = checkGroups([
      { ...REFUSED, memberId: 'today', status: 'needs_pan', refusal: null, updatedAt: '2026-11-08T10:00:00Z' },
      { ...REFUSED, memberId: 'october', status: 'needs_pan', refusal: null, updatedAt: '2026-10-20T10:00:00Z' },
    ]);
    expect(groups.onMember.map((check) => check.memberId)).toEqual(['october', 'today']);
  });
});

describe('sinceText and queueLine', () => {
  const now = new Date('2026-11-08T15:00:00Z');

  it('gives the time for a wait that began today, and from the second day the date and how many days (audit F-092)', () => {
    const today = new Date('2026-11-08T09:00:00Z');
    const october = new Date('2026-10-20T09:00:00Z');
    expect(sinceText(today, now)).toBe(formatTime(today));
    expect(sinceText(october, now)).toBe(`${formatDate(october)} · 19 days`);
    const yesterday = new Date('2026-11-07T09:00:00Z');
    expect(sinceText(yesterday, now)).toBe(`${formatDate(yesterday)} · 1 day`);
    // 23:30 last night, read at 20:30: under 24 hours ago, but yesterday.
    const lastNight = new Date('2026-11-07T18:00:00Z');
    expect(sinceText(lastNight, now)).toBe(`${formatDate(lastNight)} · 1 day`);
  });

  it('says a check waits for a PAN, and since when', () => {
    const check: KycCheck = { ...REFUSED, status: 'needs_pan', refusal: null, updatedAt: '2026-10-20T09:00:00Z' };
    expect(queueLine(check, now)).toBe(`Needs a PAN · since ${formatDate(new Date(check.updatedAt))} · 19 days`);
  });
});

describe('mayReopen', () => {
  it('offers a super admin Reopen for an in-person check refused as a duplicate PAN or Aadhaar, which the database reopens', () => {
    expect(mayReopen(REFUSED, true)).toBe(true);
    expect(mayReopen({ ...REFUSED, refusal: 'duplicate_aadhaar' }, true)).toBe(true);
  });

  it('offers it for no other refusal, as the database would refuse it', () => {
    for (const refusal of ['under_18', 'staff_rejected', 'duplicate_face', 'on_break'] as const) {
      expect(mayReopen({ ...REFUSED, refusal }, true)).toBe(false);
    }
  });

  it('offers a super admin Reopen for a check the vendor held while the club checks identity at the desk (decision 0502)', () => {
    const held = { ...REFUSED, method: 'digilocker' } as const;
    expect(mayReopen(held, true, true)).toBe(true);
    expect(mayReopen({ ...held, status: 'needs_review', refusal: null }, true, true)).toBe(true);
    expect(mayReopen({ ...held, refusal: 'under_18' }, true, true)).toBe(false);
    expect(mayReopen({ ...held, status: 'needs_pan', refusal: null }, true, true)).toBe(false);
    expect(mayReopen(held, false, true)).toBe(false);
    expect(mayReopen({ ...held, status: 'needs_review', refusal: null }, true, false)).toBe(false);
  });

  it('offers it to no one but a super admin, and for no check not done in person', () => {
    expect(mayReopen(REFUSED, false)).toBe(false);
    expect(mayReopen({ ...REFUSED, method: 'digilocker' }, true)).toBe(false);
  });
});
