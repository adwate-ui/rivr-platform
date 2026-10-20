import type { DisplayMode, TierCell, TierCellChange, TierFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** A cell as the screen offers it: on, or off and shown as locked or hidden. */
export type CellState = 'on' | DisplayMode;
export const CELL_STATES: readonly CellState[] = ['on', 'locked', 'hidden'];

export const STATE_LABEL: Readonly<Record<CellState, MessageKey>> = {
  on: 'console.tiers.on',
  locked: 'console.tiers.locked',
  hidden: 'console.tiers.hidden',
};

/** What the Tiers screen says when a save or a withdrawal did not go through. */
export const TIER_FAILURE_COPY: Readonly<Record<TierFailure, MessageKey>> = {
  not_allowed: 'console.tiers.notAllowedAction',
  in_past: 'console.tiers.inPast',
  changed: 'console.tiers.changed',
  unavailable: 'console.tiers.unavailable',
};

/** How a saved cell reads as a choice. */
export function stateOf(cell: Pick<TierCell, 'isEnabled' | 'displayMode'>): CellState {
  return cell.isEnabled ? 'on' : cell.displayMode;
}

/** The cell to save for a choice. A feature that's on keeps "locked" for whenever it's next taken away. */
export function changeOf(tierId: string, featureKey: string, state: CellState): TierCellChange {
  return state === 'on'
    ? { tierId, featureKey, isEnabled: true, displayMode: 'locked' }
    : { tierId, featureKey, isEnabled: false, displayMode: state };
}
