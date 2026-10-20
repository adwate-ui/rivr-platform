import { isZero, subtract, type Paise } from '../money/index.ts';

/**
 * A cage shift's four figures (#45): cash in the drawer, chips in the cage, UPI and bank receipts, and
 * the signed markers held. Either what the close counted, or what the ledger says it should be.
 */
export interface ShiftFigures {
  readonly cash: Paise;
  readonly chips: Paise;
  readonly receipts: Paise;
  readonly markers: Paise;
}

/** A shift's close: each figure counted less expected (below zero when short), and whether any differs. */
export interface ShiftClose {
  readonly variance: ShiftFigures;
  /** Any variance at all, either way: an anomaly, closed only with a reviewed reason. */
  readonly isAnomaly: boolean;
}

/**
 * The end-of-day close of a cage shift (scope-v1 module 5): a shift closes to zero variance between
 * what was counted and the ledger; any variance, however small and either way, is an anomaly. There is
 * no threshold. The database's private.shift_close is proved equal by the same golden cases
 * (packages/testing/golden/eod.json).
 */
export function shiftClose(counted: ShiftFigures, expected: ShiftFigures): ShiftClose {
  const variance: ShiftFigures = {
    cash: subtract(counted.cash, expected.cash),
    chips: subtract(counted.chips, expected.chips),
    receipts: subtract(counted.receipts, expected.receipts),
    markers: subtract(counted.markers, expected.markers),
  };
  return { variance, isAnomaly: Object.values(variance).some((amount) => !isZero(amount)) };
}
