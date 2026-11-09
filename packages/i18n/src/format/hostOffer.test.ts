import { beforeAll, describe, expect, it } from 'vitest';
import { consoleApp } from '../catalogue/en/apps.ts';
import { registerMessages } from '../translate.ts';
import { formatHostOffer } from './hostOffer.ts';

beforeAll(() => registerMessages({ console: consoleApp }));

describe('a host\u2019s offer in words', () => {
  it('names what was offered, a bonus as chips, never rupees', () => {
    expect(formatHostOffer({ kind: 'points', points: 500 })).toBe('500 points');
    expect(formatHostOffer({ kind: 'bonus', amount_paise: 200000 })).toBe('2,000 bonus chips');
    expect(formatHostOffer({ kind: 'spin' })).toBe('a free spin');
    expect(formatHostOffer({ kind: 'message' })).toBe('a message');
  });

  it('says an offer for anything the queue does not make, or a points multiplier', () => {
    expect(formatHostOffer({ kind: 'cab_eligibility' })).toBe('an offer');
    expect(formatHostOffer({ kind: 'points' })).toBe('an offer');
  });
});
