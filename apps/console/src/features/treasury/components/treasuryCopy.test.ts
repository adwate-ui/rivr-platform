import type { ChipInventory, Treasury } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { describe, expect, it } from 'vitest';
import { balanceRows, countedLine, shiftLine, TREASURY_FAILURE_COPY } from './treasuryCopy.ts';

const SHIFT = { shiftId: 's1', float: fromPaise(120_000_000n), openedAt: '2026-10-20T12:30:00Z', openedBy: 'Sana Qureshi' };
const TREASURY: Treasury = {
  wallets: fromPaise(141_150_000n), withdrawalsPending: fromPaise(2_500_000n), bonus: fromPaise(400_000n), markers: fromPaise(28_500_000n),
  jackpots: fromPaise(34_260_000n), chipsInPlay: fromPaise(9_800_000n), shift: SHIFT,
};
const INVENTORY: ChipInventory = { lines: [], inCage: null, countedAt: null, countedBy: null };

describe('what the Treasury says (#24)', () => {
  it('lists what the venue holds in the prototype\'s order, then the chips in play and the cage float', () => {
    expect(balanceRows(TREASURY).map((row) => [row.label, row.paise])).toEqual([
      ['Member wallets', 141_150_000n], ['Withdrawals pending', 2_500_000n], ['Bonus liability', 400_000n], ['Markers outstanding', 28_500_000n],
      ['Jackpots held', 34_260_000n], ['Chips in play', 9_800_000n], ['Cage float', 120_000_000n],
    ]);
  });

  it('has no cage float while no shift is open', () => {
    expect(balanceRows({ ...TREASURY, shift: null }).at(-1)).toEqual({ label: 'Cage float', paise: null });
  });

  it('says when the shift opened and who opened it, in IST', () => {
    expect(shiftLine(SHIFT)).toBe('Opened Tue 20 Oct, 18:00 by Sana Qureshi');
  });

  it('says when the chips were last counted and by whom, or that they have not been', () => {
    expect(countedLine({ ...INVENTORY, countedAt: '2026-10-20T12:45:00Z', countedBy: 'Sana Qureshi' })).toBe('Counted Tue 20 Oct, 18:15 by Sana Qureshi');
    expect(countedLine(INVENTORY)).toBe('Not counted');
  });

  it('says why a shift or a count did not go through, and what to do', () => {
    expect(t(TREASURY_FAILURE_COPY.shift_open)).toBe('A shift is open already. The screen now shows it.');
    expect(t(TREASURY_FAILURE_COPY.no_shift)).toBe('No shift is open. Open one with the float first.');
    expect(t(TREASURY_FAILURE_COPY.invalid)).toBe('Count every chip, 0 for none, and give the float in whole rupees.');
  });
});
