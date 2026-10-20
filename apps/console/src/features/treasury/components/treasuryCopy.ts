import type { CageShift, ChipInventory, Treasury, TreasuryFailure } from '@rivr/db';
import type { Paise } from '@rivr/domain/money';
import { formatDayTime, t, type MessageKey } from '@rivr/i18n';

/** One row of the Treasury: what it is, and how much; null for a cage float with no shift open. */
export interface BalanceRow {
  readonly label: string;
  readonly paise: Paise | null;
}

/** The Treasury's rows, in the prototype's order: what the venue holds for players, the chips in play, and the cage float. */
export function balanceRows(treasury: Treasury): BalanceRow[] {
  return [
    { label: t('console.treasury.wallets'), paise: treasury.wallets },
    { label: t('console.treasury.withdrawalsPending'), paise: treasury.withdrawalsPending },
    { label: t('console.treasury.bonus'), paise: treasury.bonus },
    { label: t('console.treasury.markers'), paise: treasury.markers },
    { label: t('console.treasury.jackpots'), paise: treasury.jackpots },
    { label: t('console.treasury.chipsInPlay'), paise: treasury.chipsInPlay },
    { label: t('console.treasury.float'), paise: treasury.shift?.float ?? null },
  ];
}

/** When the open shift began, and who opened it. */
export function shiftLine(shift: CageShift): string {
  return t('console.treasury.shiftOpen', { time: formatDayTime(new Date(shift.openedAt)), name: shift.openedBy });
}

/** When the chips were last counted and by whom, or that they have not been this shift. */
export function countedLine(inventory: ChipInventory): string {
  if (inventory.countedAt === null || inventory.countedBy === null) return t('console.treasury.notCounted');
  return t('console.treasury.counted', { time: formatDayTime(new Date(inventory.countedAt)), name: inventory.countedBy });
}

/** Why a shift or a count did not go through, for the cashier. */
export const TREASURY_FAILURE_COPY: Readonly<Record<TreasuryFailure, MessageKey>> = {
  shift_open: 'console.treasuryFailures.shiftOpen',
  no_shift: 'console.treasuryFailures.noShift',
  invalid: 'console.treasuryFailures.invalid',
  not_allowed: 'console.treasuryFailures.notAllowed',
  unavailable: 'console.treasuryFailures.unavailable',
};
