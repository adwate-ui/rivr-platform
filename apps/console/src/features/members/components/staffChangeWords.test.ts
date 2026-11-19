import { en, registerMessages } from '@rivr/i18n';
import type { MemberStaffChange } from '@rivr/db';
import { beforeAll, describe, expect, it } from 'vitest';
import { fieldLines, whatWords } from './staffChangeWords.ts';

beforeAll(() => registerMessages(en));

/** A change by staff to an ID check, with the fields given. */
function change(fields: MemberStaffChange['fields'], action = 'update'): MemberStaffChange {
  return { id: 1, at: '2026-11-19T16:10:00Z', who: 'Aditya Malhotra', action, entity: 'kyc_record', reason: null, fields };
}

describe('A change by staff in words', () => {
  it('says what was done and to what, in the Activity screen words', () => {
    expect(whatWords(change([]))).toBe('Changed · ID check');
    expect(whatWords(change([], 'member.hours_reset'))).toMatch(/^Reset hours · /);
  });

  it('says each field before and after in plain words, a code as words and a moment in IST', () => {
    const lines = fieldLines(change([
      { entity: 'kyc_record', field: 'status', before: 'needs_review', after: 'verified', isHidden: false },
      { entity: 'seat_session', field: 'ended_at', before: null, after: '2026-11-19T16:10:00Z', isHidden: false },
      { entity: 'bonus_grant', field: 'amount_paise', before: null, after: 50000, isHidden: false },
    ]));
    expect(lines[0]).toBe('Status: In review → Checked');
    expect(lines[1]).toMatch(/^Left: None → 19 Nov 2026, 21:40$/);
    expect(lines[2]).toMatch(/^Amount: None → .*500/);
  });

  it('never shows an identity number, nor a column without words of its own', () => {
    const lines = fieldLines(change([
      { entity: 'kyc_record', field: 'pan', before: null, after: null, isHidden: true },
      { entity: 'kyc_record', field: 'vendor_calls_since', before: 'a', after: 'b', isHidden: false },
    ]));
    expect(lines).toEqual(['PAN changed']);
  });

  it('shows the mobile as a number and a yes or no in words', () => {
    const lines = fieldLines(change([
      { entity: 'member', field: 'phone', before: '+919800000001', after: '+919800000002', isHidden: false },
      { entity: 'member_feature_override', field: 'is_granted', before: false, after: true, isHidden: false },
    ]));
    expect(lines[0]).toMatch(/^Mobile: .*0001 → .*0002$/);
    expect(lines[1]).toBe('Given: No → Yes');
  });
});
