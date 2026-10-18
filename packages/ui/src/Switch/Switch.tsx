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
    <div className={cx('flex min-h-touch items-center justify-between gap-4', isDisabled && 'opacity-disabled')}>
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
        className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-end disabled:cursor-not-allowed"
      >
        <span
          aria-hidden="true"
          className={cx('inline-flex h-6 w-10 items-center rounded-lg p-1 transition-colors', isOn ? 'bg-action' : 'bg-hairline')}
        >
          <span className={cx('size-4 rounded-sm bg-cream transition-transform', isOn && 'translate-x-4')} />
        </span>
      </button>
    </div>
  );
}
