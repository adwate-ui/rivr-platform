import type { SettingField } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { fieldLabel } from './settingsCopy.ts';
import { draftsFrom, readValue, valueFrom } from './valueDraft.ts';

const RAKE: readonly SettingField[] = [
  { kind: 'integer', name: 'rate_basis_points', min: 0, max: 1000, isMoney: false },
  { kind: 'integer', name: 'cap_paise', min: 0, max: 10_000_000, isMoney: true },
];
// High-hand payouts are money though their names don't say so: their schema holds them in whole ₹50 chips.
const HIGH_HANDS: readonly SettingField[] = [
  { kind: 'integer', name: 'royal_flush', min: 0, max: 10_000_000, isMoney: true },
  { kind: 'integer', name: 'straight_flush', min: 0, max: 10_000_000, isMoney: true },
  { kind: 'integer', name: 'four_of_a_kind', min: 0, max: 10_000_000, isMoney: true },
];
const SPLIT: readonly SettingField[] = ['pool', 'loser', 'winner', 'table'].map((part) => ({
  kind: 'integer' as const, name: `${part}_basis_points`, min: 0, max: 10_000, isMoney: false,
}));
const TDS: readonly SettingField[] = [
  { kind: 'boolean', name: 'enabled' },
  { kind: 'choice', name: 'basis', options: ['session', 'day'] },
  { kind: 'text', name: 'section' },
];

describe('a setting value as the Settings screen types it (#33)', () => {
  it('names a field from its schema name, without the unit', () => {
    expect(fieldLabel('cap_paise')).toBe('Cap');
    expect(fieldLabel('rate_basis_points')).toBe('Rate');
    expect(fieldLabel('only_at_qualifying_stake')).toBe('Only at qualifying stake');
  });

  it('starts from the value in force, with money in rupees as written', () => {
    expect(draftsFrom(RAKE, { rate_basis_points: 500, cap_paise: 500_000 })).toEqual({ rate_basis_points: '500', cap_paise: '₹5,000' });
    expect(draftsFrom(TDS, null)).toEqual({ enabled: false, basis: '', section: '' });
  });

  it('reads money typed in rupees as paise, and numbers within their limits', () => {
    expect(valueFrom(RAKE, { rate_basis_points: '450', cap_paise: '₹6,000' })).toEqual({ value: { rate_basis_points: 450, cap_paise: 600_000 } });
    expect(valueFrom(RAKE, { rate_basis_points: '450', cap_paise: '6000' })).toEqual({ value: { rate_basis_points: 450, cap_paise: 600_000 } });
  });

  it('names every field that is missing, not a number, or past its limits', () => {
    expect(valueFrom(RAKE, { rate_basis_points: '2000', cap_paise: 'lots' })).toEqual({ invalid: ['rate_basis_points', 'cap_paise'] });
    expect(valueFrom(RAKE, { rate_basis_points: '-1', cap_paise: '' })).toEqual({ invalid: ['rate_basis_points', 'cap_paise'] });
    expect(valueFrom(TDS, { enabled: true, basis: '', section: '194B' })).toEqual({ invalid: ['basis'] });
  });

  it('keeps switches, choices and text as they are', () => {
    expect(valueFrom(TDS, { enabled: false, basis: 'day', section: ' 194B ' })).toEqual({ value: { enabled: false, basis: 'day', section: '194B' } });
  });

  it('shows and reads high-hand payouts in rupees, as money', () => {
    expect(draftsFrom(HIGH_HANDS, { royal_flush: 2_500_000, straight_flush: 1_000_000, four_of_a_kind: 200_000 }).royal_flush).toBe('₹25,000');
    expect(valueFrom(HIGH_HANDS, { royal_flush: '30000', straight_flush: '10000', four_of_a_kind: '2000' }))
      .toEqual({ value: { royal_flush: 3_000_000, straight_flush: 1_000_000, four_of_a_kind: 200_000 } });
  });

  it('checks a known key against its schema in @rivr/contracts: whole ₹50 chips, a split that adds up', () => {
    expect(readValue('rake.config', RAKE, { rate_basis_points: '500', cap_paise: '3025' })).toEqual({ invalid: ['cap_paise'] });
    const split = { pool_basis_points: '10000', loser_basis_points: '5000', winner_basis_points: '3000', table_basis_points: '1000' };
    expect(readValue('jackpot.payout', SPLIT, split)).toEqual({ invalid: SPLIT.map((field) => field.name) });
    expect(readValue('jackpot.payout', SPLIT, { ...split, table_basis_points: '2000' })).toHaveProperty('value');
    expect(readValue('a_lane.new_key', RAKE, { rate_basis_points: '500', cap_paise: '3025' })).toHaveProperty('value');
  });
});
