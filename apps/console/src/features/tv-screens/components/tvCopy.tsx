import { TV_MODES, type TvMode } from '@rivr/contracts';
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

/** One chip per display mode. Pressing the chosen mode again keeps it: a TV always shows something. */
export function ModeChips({ label, value, onChange, isDisabled = false }: ModeChipsProps) {
  return (
    <ChoiceChips label={label} mode="one" selected={value === null ? [] : [value]} isDisabled={isDisabled}
      options={TV_MODES.map((mode) => ({ value: mode, label: t(`tv.modes.${mode}`) }))}
      onChange={(chosen) => { if (chosen[0] !== undefined) onChange(chosen[0]); }} />
  );
}
