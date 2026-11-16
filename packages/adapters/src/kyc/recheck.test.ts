import { ok, panSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeKyc, createRefusalBreaker, panRecheckFailure, panRecheckOutcome } from './index.ts';

const check = { pan: panSchema.parse('ABCPG3001G'), name: 'Anaya Gill', dateOfBirth: '1990-04-04' };
const answer = { isValid: true, nameMatches: true, dateOfBirthMatches: true, vendorReference: 'fake-pan' };

describe('re-checking a KYC check made in person', () => {
  it('finds a match when the vendor knows the PAN in the name and date of birth given', async () => {
    expect(panRecheckOutcome(await createFakeKyc().verifyPan(check))).toBe('matched');
  });

  it('finds a mismatch when the vendor does not know the PAN', async () => {
    expect(panRecheckOutcome(await createFakeKyc({ isPanValid: false }).verifyPan(check))).toBe('pan_invalid');
  });

  it('says which detail differs when the PAN is real', () => {
    expect(panRecheckOutcome(ok({ ...answer, nameMatches: false }))).toBe('name_differs');
    expect(panRecheckOutcome(ok({ ...answer, dateOfBirthMatches: false }))).toBe('date_of_birth_differs');
  });

  it('leaves the check for later when the vendor cannot answer', async () => {
    const kyc = createFakeKyc();
    kyc.failNext({ code: 'unavailable' });
    expect(panRecheckOutcome(await kyc.verifyPan(check))).toBeNull();
  });
});

describe('a re-check whose PAN call failed (decision 0674)', () => {
  it.each([
    ['the vendor is down', { code: 'unavailable' }],
    ['too many requests', { code: 'rate_limited' }],
    ['no keys', { code: 'not_configured' }],
    ['an outage after a paid call, kept a refusal so the call is not given back', { code: 'rejected', reason: 'Zoop date of birth unavailable', cause: 'unavailable' }],
    ['too many requests after a paid call', { code: 'rejected', reason: 'Zoop date of birth rate_limited', cause: 'rate_limited' }],
  ] as const)('asks again later, uncounted, when %s', (_, failure) => {
    expect(panRecheckFailure(failure)).toBe('later');
  });

  it('pauses every re-check when the vendor refuses RIVR\'s account, not this request', () => {
    expect(panRecheckFailure({ code: 'rejected', reason: 'Zoop 403', cause: 'account' })).toBe('pause');
  });

  it('counts a refusal of this check\'s request', () => {
    expect(panRecheckFailure({ code: 'rejected', reason: 'Zoop 106' })).toBe('refused');
  });
});

// Issue 1033: one refusal turning down many checks alike is the vendor's trouble.
describe('a run\'s refusals, held until it ends', () => {
  it('counts refusals that turned down fewer than three checks alike', () => {
    const breaker = createRefusalBreaker();
    expect(breaker.hold('Zoop 106', 'a')).toBe(false);
    expect(breaker.hold('Zoop 106', 'b')).toBe(false);
    expect(breaker.hold('Zoop 102', 'c')).toBe(false);
    expect(breaker.toCount()).toEqual([
      { reason: 'Zoop 106', memberId: 'a' }, { reason: 'Zoop 106', memberId: 'b' }, { reason: 'Zoop 102', memberId: 'c' },
    ]);
  });

  it('trips when one reason turns down a third check, and counts none of that reason\'s refusals', () => {
    const breaker = createRefusalBreaker();
    breaker.hold('Zoop unreadable', 'a');
    breaker.hold('Zoop 102', 'b');
    breaker.hold('Zoop unreadable', 'c');
    expect(breaker.hold('Zoop unreadable', 'd')).toBe(true);
    expect(breaker.toCount()).toEqual([{ reason: 'Zoop 102', memberId: 'b' }]);
  });

  it('counts the checks that tripped a released reason, and those it turns down after while fewer than three', () => {
    const breaker = createRefusalBreaker();
    breaker.hold('Zoop 106', 'a');
    breaker.hold('Zoop 106', 'b');
    expect(breaker.hold('Zoop 106', 'c')).toBe(true);
    breaker.release('Zoop 106');
    expect(breaker.isReleased('Zoop 106')).toBe(true);
    expect(breaker.hold('Zoop 106', 'd')).toBe(false);
    expect(breaker.toCount().map((refusal) => refusal.memberId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('stays armed for a released reason: three more checks turned down alike trip it again, counted against none', () => {
    const breaker = createRefusalBreaker();
    for (const check of ['a', 'b', 'c']) breaker.hold('Zoop unreadable', check);
    breaker.release('Zoop unreadable');
    expect(breaker.hold('Zoop unreadable', 'd')).toBe(false);
    expect(breaker.hold('Zoop unreadable', 'e')).toBe(false);
    expect(breaker.hold('Zoop unreadable', 'f')).toBe(true);
    expect(breaker.toCount().map((refusal) => refusal.memberId)).toEqual(['a', 'b', 'c']);
  });

  it('counts a check once, however often the same reason turns it down', () => {
    const breaker = createRefusalBreaker();
    breaker.hold('Zoop 106', 'a');
    expect(breaker.hold('Zoop 106', 'a')).toBe(false);
    expect(breaker.toCount()).toEqual([{ reason: 'Zoop 106', memberId: 'a' }]);
  });
});
