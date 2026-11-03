import type { SettingField } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { shownInBonusChips } from './bonusChips.ts';
import { fieldLabel, limitsText, unitOf, valueText } from './settingsCopy.ts';
import { draftsFrom, readValue, valueFrom } from './valueDraft.ts';

type NumberField = Extract<SettingField, { kind: 'integer' }>;

/** A number field: a count unless money, chips or optional are given. */
const number = (name: string, min: number, max: number, more: Partial<NumberField> = {}): NumberField => ({
  kind: 'integer', name, min, max, isMoney: false, isChips: false, isRequired: true, ...more,
});

const RATE = number('rate_basis_points', 0, 1000);
const CAP = number('cap_paise', 0, 10_000_000, { isMoney: true, isChips: true });
const RAKE: readonly SettingField[] = [RATE, CAP];
// High-hand payouts are money though their names don't say so: their schema holds them in whole ₹50 chips.
const HIGH_HANDS: readonly SettingField[] = ['royal_flush', 'straight_flush', 'four_of_a_kind'].map((name) => ({
  kind: 'integer' as const, name, min: 0, max: 10_000_000, isMoney: true, isChips: true, isRequired: true,
}));
const SPLIT: readonly SettingField[] = ['pool', 'loser', 'winner', 'table'].map((part) => ({
  kind: 'integer' as const, name: `${part}_basis_points`, min: 0, max: 10_000, isMoney: false, isChips: false, isRequired: true,
}));
const TDS: readonly SettingField[] = [
  { kind: 'boolean', name: 'enabled', isRequired: true },
  { kind: 'choice', name: 'basis', options: ['session', 'day'], isRequired: true },
  { kind: 'text', name: 'section', isRequired: true },
];
const MINUTES = number('minutes', 1, 120);
const HOLD: readonly SettingField[] = [MINUTES];
// Rakeback's cap may be left out; the share has no prefix on its name.
const SHARE = number('basis_points', 0, 10_000);
const LASTS = number('expires_days', 1, 365);
const RAKEBACK: readonly SettingField[] = [SHARE, number('cap_paise', 5_000, 10_000_000, { isMoney: true, isChips: true, isRequired: false }), LASTS];
const CHANNELS: readonly SettingField[] = [{ kind: 'choices', name: 'channels', options: ['instagram', 'facebook', 'telegram'], isRequired: true }];
const tierName = (id: string) => id;

describe('a setting value as the Settings screen types it', () => {
  it('names a field in words from the setting\'s copy, falling back to its schema name', () => {
    expect(fieldLabel('rake.config', 'cap_paise')).toBe('Cap');
    expect(fieldLabel('waitlist.hold_minutes', 'minutes')).toBe('Minutes');
    expect(fieldLabel('a_lane.new_key', 'only_at_qualifying_stake')).toBe('Only at qualifying stake');
  });

  it('types a rate in percent, money in rupees after the ₹, and a time in its unit', () => {
    expect(unitOf(RATE)).toBe('percent');
    expect(unitOf(SHARE)).toBe('percent');
    expect(unitOf(MINUTES)).toBe('minutes');
    expect(unitOf(LASTS)).toBe('days');
    expect(unitOf(CAP)).toBeNull();
    expect(draftsFrom(RAKE, { rate_basis_points: 525, cap_paise: 500_000 })).toEqual({ rate_basis_points: '5.25', cap_paise: '5000' });
    expect(draftsFrom(TDS, null)).toEqual({ enabled: false, basis: '', section: '' });
  });

  it('reads a percentage of up to two decimals as basis points, and rupees as paise', () => {
    expect(valueFrom(RAKE, { rate_basis_points: '4.5', cap_paise: '6,000' })).toEqual({ value: { rate_basis_points: 450, cap_paise: 600_000 } });
    expect(valueFrom(RAKE, { rate_basis_points: '5.255', cap_paise: '6000' })).toEqual({ invalid: ['rate_basis_points'] });
  });

  it('names every field that is missing, not a number, or past its limits', () => {
    expect(valueFrom(RAKE, { rate_basis_points: '20', cap_paise: 'lots' })).toEqual({ invalid: ['rate_basis_points', 'cap_paise'] });
    expect(valueFrom(HOLD, { minutes: '500' })).toEqual({ invalid: ['minutes'] });
    expect(valueFrom(TDS, { enabled: true, basis: '', section: '194B' })).toEqual({ invalid: ['basis'] });
  });

  it('leaves an optional field out when it is empty, and saves a list as chosen', () => {
    expect(valueFrom(RAKEBACK, { basis_points: '10', cap_paise: '', expires_days: '30' })).toEqual({ value: { basis_points: 1000, expires_days: 30 } });
    expect(valueFrom(CHANNELS, { channels: ['instagram', 'telegram'] })).toEqual({ value: { channels: ['instagram', 'telegram'] } });
    expect(valueFrom(CHANNELS, { channels: [] })).toEqual({ value: { channels: [] } });
  });

  it('keeps switches, choices and text as they are', () => {
    expect(valueFrom(TDS, { enabled: false, basis: 'day', section: ' 194B ' })).toEqual({ value: { enabled: false, basis: 'day', section: '194B' } });
  });

  it('shows and reads high-hand payouts in rupees, as money', () => {
    expect(draftsFrom(HIGH_HANDS, { royal_flush: 2_500_000, straight_flush: 1_000_000, four_of_a_kind: 200_000 }).royal_flush).toBe('25000');
    expect(valueFrom(HIGH_HANDS, { royal_flush: '30000', straight_flush: '10000', four_of_a_kind: '2000' }))
      .toEqual({ value: { royal_flush: 3_000_000, straight_flush: 1_000_000, four_of_a_kind: 200_000 } });
  });

  it('checks a known key against its schema in @rivr/contracts: whole ₹50 chips, a split that adds up', () => {
    expect(readValue('rake.config', RAKE, { rate_basis_points: '5', cap_paise: '3025' })).toEqual({ invalid: ['cap_paise'] });
    const split = { pool_basis_points: '100', loser_basis_points: '50', winner_basis_points: '30', table_basis_points: '10' };
    expect(readValue('jackpot.payout', SPLIT, split)).toEqual({ notTogether: true });
    expect(readValue('jackpot.payout', SPLIT, { ...split, table_basis_points: '20' })).toHaveProperty('value');
    expect(readValue('a_lane.new_key', RAKE, { rate_basis_points: '5', cap_paise: '3025' })).toHaveProperty('value');
  });

  it('says a value in words, and a field\'s limits in its unit', () => {
    expect(valueText('waitlist.hold_minutes', HOLD, { minutes: 30 }, tierName)).toBe('30 minutes');
    expect(valueText('rake.config', RAKE, { rate_basis_points: 500, cap_paise: 300_000 }, tierName)).toBe('Rate: 5% · Cap: ₹3,000');
    expect(valueText('social.connected_channels', CHANNELS, { channels: ['instagram', 'telegram'] }, tierName)).toBe('Instagram and Telegram');
    expect(limitsText(MINUTES)).toBe('Between 1 and 120 minutes.');
    expect(limitsText(CAP)).toBe('Between ₹0 and ₹1,00,000. In whole ₹50 chips.');
    expect(limitsText(RATE)).toBe('Between 0% and 10%. Up to two decimals.');
  });
});

describe('numbers as people type them', () => {
  it('keeps a money field\'s paise when the form fills it, so saving another field leaves it as it was', () => {
    const price = number('price_paise', 1, 10_000_000, { isMoney: true });
    expect(draftsFrom([price], { price_paise: 250_050 })).toEqual({ price_paise: '2500.50' });
    expect(valueFrom([price], { price_paise: '2500.50' })).toEqual({ value: { price_paise: 250_050 } });
  });

  it('takes digits grouped as the limits show them', () => {
    const rows = number('rows', 1, 1_000_000);
    expect(valueFrom([rows], { rows: '10,00,000' })).toEqual({ value: { rows: 1_000_000 } });
    expect(valueFrom([RATE], { rate_basis_points: '5.25' })).toEqual({ value: { rate_basis_points: 525 } });
  });
});

describe('the spin wheel budget in bonus chips, never rupees (owner, 3 Nov)', () => {
  // As the database gives it: a money field in paise, in whole ₹50 chips; the console shows it in bonus chips.
  const [budget] = shownInBonusChips({
    key: 'spin.budget', description: '', scope: 'venue', subjects: [],
    fields: [number('monthly_paise', 0, 100_000_000, { isMoney: true, isChips: true })],
  }).fields;
  const fields = budget === undefined ? [] : [budget];

  it('shows the budget and its limits in bonus chips, with no ₹', () => {
    expect(valueText('spin.budget', fields, { monthly_paise: 500_000 }, tierName)).toBe('5,000 bonus chips');
    if (budget?.kind !== 'integer') throw new Error('The budget is a number');
    expect(limitsText(budget)).toBe('Between 0 bonus chips and 10,00,000 bonus chips. In fifties.');
    expect(limitsText(budget)).not.toContain('₹');
  });

  it('fills the form in chips and saves a changed value back in paise', () => {
    expect(draftsFrom(fields, { monthly_paise: 500_000 })).toEqual({ monthly_paise: '5000' });
    expect(readValue('spin.budget', fields, { monthly_paise: '7,500' })).toEqual({ value: { monthly_paise: 750_000 } });
    // Bonus chips go out in fifties: 7,525 is not a budget the schema takes.
    expect(readValue('spin.budget', fields, { monthly_paise: '7525' })).toEqual({ invalid: ['monthly_paise'] });
  });

  it('leaves every other setting as the database gave it', () => {
    const setting = { key: 'rake.config', description: '', scope: 'venue' as const, subjects: [], fields: RAKE };
    expect(shownInBonusChips(setting)).toBe(setting);
  });
});
