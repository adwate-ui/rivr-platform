import { HIDDEN_TV_MODES, TV_MODES, type TvMode } from '@rivr/contracts';
import type { TvFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { ChoiceChips } from '@rivr/ui';

/** What the console's TVs screen says when pairing, changing a mode or unpairing did not go through. */
export const TV_FAILURE_COPY: Readonly<Record<TvFailure, MessageKey>> = {
  wrong_code: 'console.tvs.wrongCode',
  not_allowed: 'console.tvs.notAllowedAction',
  paused: 'console.tvs.paused',
  invalid: 'console.tvs.changed',
  unavailable: 'console.tvs.unavailable',
};

interface ModeChipsProps {
  label: string;
  /** The mode chosen, or null for a TV that has none. */
  value: TvMode | null;
  onChange: (mode: TvMode) => void;
  isDisabled?: boolean;
}

/** One chip per display mode the club shows (#628). Pressing the chosen mode again keeps it: a TV always shows something. */
export function ModeChips({ label, value, onChange, isDisabled = false }: ModeChipsProps) {
  return (
    <ChoiceChips label={label} mode="one" selected={value === null ? [] : [value]} isDisabled={isDisabled}
      options={TV_MODES.filter((mode) => !HIDDEN_TV_MODES.includes(mode)).map((mode) => ({ value: mode, label: t(`tv.modes.${mode}`) }))}
      onChange={(chosen) => { if (chosen[0] !== undefined) onChange(chosen[0]); }} />
  );
}

// The boards a TV can turn to in between its main one (decision 0163): the ones built so far, but the jackpot (#628).
const ROTATING: readonly TvMode[] = ['waitlist', 'call_time', 'promotions', 'rewards', 'league'];

interface RotationChipsProps {
  label: string;
  /** The TV's main mode, which is never in its rotation. */
  mode: TvMode | null;
  /** The boards it turns to, in the order they were chosen. */
  value: readonly TvMode[];
  onChange: (rotation: TvMode[]) => void;
  isDisabled?: boolean;
}

/** One chip per board a TV can turn to after its main one, in the order pressed. */
export function RotationChips({ label, mode, value, onChange, isDisabled = false }: RotationChipsProps) {
  return (
    <ChoiceChips label={label} selected={value} isDisabled={isDisabled} onChange={onChange}
      options={ROTATING.filter((board) => board !== mode).map((board) => ({ value: board, label: t(`tv.modes.${board}`) }))} />
  );
}

