import { useId } from 'react';
import { cx } from '../internal/classes.ts';
import { Label } from '../Label/Label.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

export interface SwitchProps {
  /** What it turns on, sentence case: "Seat calls". */
  label: string;
  /** One line under the label, for example when the notification comes. */
  hint?: string;
  isOn: boolean;
  onChange: (isOn: boolean) => void;
  /** Dims the row and ignores presses, for example while a change is saved. */
  isDisabled?: boolean;
}

/**
 * An on-off setting in a 44 px row: the label on the left, the switch on the right. The switch's
 * target is 44 px square around its track, and the label presses it too.
 */
export function Switch({ label, hint, isOn, onChange, isDisabled }: SwitchProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex min-h-touch items-center justify-between gap-4">
      <Stack gap={1} grow>
        <Label htmlFor={id} variant="setting">{label}</Label>
        {hint ? (
          <Text variant="caption" tone="muted" id={hintId}>
            {hint}
          </Text>
        ) : null}
      </Stack>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-describedby={hint ? hintId : undefined}
        disabled={isDisabled}
        onClick={() => onChange(!isOn)}
        className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-end disabled:cursor-not-allowed disabled:opacity-disabled"
      >
        <span
          aria-hidden="true"
          data-switch-track=""
          // The prototype's 46 x 28 track with a round knob (#786). Off, the track is clear and its edge is the control
          // colour: the cream knob on it is clear, and the track meets 3:1 on the page (F5-04).
          className={cx('inline-flex h-switch-height w-switch-width items-center rounded-full border px-switch-inset transition-colors',
            isOn ? 'border-action bg-action' : 'border-control bg-transparent')}
        >
          <span className={cx('size-switch-knob rounded-full transition-transform', isOn ? 'translate-x-switch-travel bg-raised' : 'bg-cream')} />
        </span>
      </button>
    </div>
  );
}
