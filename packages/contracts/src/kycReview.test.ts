import { describe, expect, it } from 'vitest';
import { isReasonInWords, kycDocumentRetakeSchema, kycInPersonSchema, kycReviewSchema } from './kycReview.ts';

const IN_PERSON = { memberId: '00000000-0000-4000-8000-000000000203', dateOfBirth: '1990-04-12', aadhaarLast4: '1234', pan: ' abcpn1234d ', consent: true, coversConfirmed: true };

describe('kycInPersonSchema', () => {
  it('takes the date of birth, the last four Aadhaar digits, the PAN and the member\'s consent', () => {
    expect(kycInPersonSchema.parse(IN_PERSON)).toEqual({ ...IN_PERSON, pan: 'ABCPN1234D' });
  });

  it('refuses the whole Aadhaar number, a malformed PAN, or no consent', () => {
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, aadhaarLast4: '123412341234' }).success).toBe(false);
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, pan: 'ABC1234' }).success).toBe(false);
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, consent: false }).success).toBe(false);
  });

  it('refuses a date of birth the database would: before 1900, as a year typed in two digits gives, or a day to come', () => {
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, dateOfBirth: '0092-04-12' }).success).toBe(false);
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, dateOfBirth: '2999-01-01' }).success).toBe(false);
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, dateOfBirth: '1900-01-01' }).success).toBe(true);
    expect(kycReviewSchema.safeParse({ reason: 'Seen at the desk', dateOfBirth: '0092-04-12', pan: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Seen at the desk', dateOfBirth: '', pan: '' }).success).toBe(true);
  });

  it('takes the word on the Aadhaar\'s bars as given or not: the database asks for it while the venue asks for the bars (decision 0663)', () => {
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, coversConfirmed: false }).success).toBe(true);
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, coversConfirmed: undefined }).success).toBe(false);
  });
});

describe('kycReviewSchema', () => {
  it('takes a reason, and a date of birth and PAN only when one is given', () => {
    expect(kycReviewSchema.parse({ reason: ' PAN card seen at the desk ', dateOfBirth: '', pan: '' })).toEqual({
      reason: 'PAN card seen at the desk', dateOfBirth: undefined, pan: undefined,
    });
    expect(kycReviewSchema.parse({ reason: 'Aadhaar seen', dateOfBirth: '1992-03-04', pan: ' abcpn5555n ' })).toEqual({
      reason: 'Aadhaar seen', dateOfBirth: '1992-03-04', pan: 'ABCPN5555N',
    });
  });

  it('refuses a decision without a reason, with a document number in it, or with a date or PAN that is not one', () => {
    expect(kycReviewSchema.safeParse({ reason: ' ', dateOfBirth: '', pan: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Aadhaar 1234 5678 9012 seen', dateOfBirth: '', pan: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Card abcpn5555n seen', dateOfBirth: '', pan: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Aadhaar seen', dateOfBirth: '04/03/1992', pan: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Aadhaar seen', dateOfBirth: '', pan: 'ABC123' }).success).toBe(false);
  });
});

describe('kycDocumentRetakeSchema', () => {
  const memberId = '00000000-0000-4000-8000-000000000203';

  it('takes a PAN with no word on bars, as a PAN has none', () => {
    expect(kycDocumentRetakeSchema.safeParse({ memberId, kind: 'pan', coversConfirmed: false }).success).toBe(true);
  });

  it('takes an Aadhaar with the word on its bars or without: the database asks for it while the bars are on (decision 0663)', () => {
    expect(kycDocumentRetakeSchema.safeParse({ memberId, kind: 'aadhaar_front', coversConfirmed: true }).success).toBe(true);
    expect(kycDocumentRetakeSchema.safeParse({ memberId, kind: 'aadhaar_front', coversConfirmed: false }).success).toBe(true);
  });

  it('refuses any other document', () => {
    expect(kycDocumentRetakeSchema.safeParse({ memberId, kind: 'passport', coversConfirmed: true }).success).toBe(false);
  });
});

describe('isReasonInWords', () => {
  it('takes a reason of three characters or more, up to the most the database keeps', () => {
    expect(isReasonInWords('  Saved on the wrong member  ', 500)).toBe(true);
    expect(isReasonInWords('Dim', 200)).toBe(true);
    expect(isReasonInWords('x'.repeat(200), 200)).toBe(true);
  });

  it('refuses one too short once trimmed, too long, or with any digit, Devanagari included', () => {
    expect(isReasonInWords('  no ', 500)).toBe(false);
    expect(isReasonInWords('x'.repeat(201), 200)).toBe(false);
    expect(isReasonInWords('Born in 1990', 500)).toBe(false);
    expect(isReasonInWords(`Aadhaar ends ${String.fromCodePoint(0x096a, 0x0969)}`, 500)).toBe(false);
  });
});
