import type { MemberListRow } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { memberExportColumns } from './memberExportColumns.ts';

const SAKSHI: MemberListRow = {
  memberId: 'm1', memberNumber: 66, fullName: 'Sakshi Tandon', phone: '+919000000266', phoneLast4: '0266', tierName: 'Black card', visits: 1,
  lastVisitAt: '2026-11-03T12:00:00Z', kycStatus: 'verified', minutesPlayed: 135, city: 'Gurugram', memberSince: '2026-10-20T10:00:00Z',
  details: {
    knownAs: 'Sakshi', ownReferralCode: 'K7M2PQ9X', occupation: 'salaried', playTimes: ['weekday_evenings', 'weekends'], gamesPlayed: ['poker', 'plo'],
    referralCode: 'FRIEND1', creatorCode: 'ASHU', campaign: { source: 'instagram', medium: 'social', name: 'diwali', content: null, term: null },
    firstSeenAt: '2026-10-19T10:00:00Z', kycMethod: 'manual', kycVerifiedAt: '2026-10-21T15:00:00Z',
    dateOfBirth: '1990-04-12', pan: 'ABCPT1234K', maskedAadhaar: 'XXXX XXXX 4321', aadhaarName: 'Sakshi Tandon', address: 'Sector 29, Gurugram',
  },
};

/** The export's added columns as heading and Sakshi's value. */
const exported = (seesIdentity: boolean) => Object.fromEntries(memberExportColumns(seesIdentity).map((column) => [column.header, column.exportValue(SAKSHI)]));

describe('the Members export\'s added columns (the owner, 9 Nov)', () => {
  it('carries the sign-up answers in words, how they came and the identity check', () => {
    expect(exported(false)).toEqual({
      'Name at sign-up': 'Sakshi', 'Their referral code': 'K7M2PQ9X', 'Last visit': '2026-11-03', Occupation: 'Salaried',
      'When they play': 'Weekday evenings, Weekends', Games: "Hold'em, PLO", 'Joined with code': 'FRIEND1', 'Creator code': 'ASHU',
      'Campaign source': 'instagram', 'Campaign medium': 'social', 'Campaign name': 'diwali', 'Campaign content': '', 'Campaign term': '',
      'First seen': '2026-10-19', 'KYC method': 'At the desk', 'KYC verified on': '2026-10-21',
    });
  });

  it('adds the identity documents for a super admin only', () => {
    expect(exported(true)).toMatchObject({
      'Date of birth': '1990-04-12', PAN: 'ABCPT1234K', Aadhaar: 'XXXX XXXX 4321', 'Name on Aadhaar': 'Sakshi Tandon', Address: 'Sector 29, Gurugram',
    });
    expect(Object.keys(exported(false))).not.toContain('PAN');
  });
});
