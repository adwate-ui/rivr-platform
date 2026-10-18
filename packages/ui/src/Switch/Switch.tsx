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
  /** Dims the switch and ignores presses, for example while a change is saved. */
  isDisabled?: boolean;
}

const TRACK = 'inline-flex h-6 w-10 shrink-0 items-center rounded-lg p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-disabled';

/**
 * An on-off setting in a 44 px row: the label on the left, the switch on the right. The label
 * presses the switch too, so the whole row is the target.
 */
export function Switch({ label, hint, isOn, onChange, isDisabled }: SwitchProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex min-h-touch items-center justify-between gap-4">
      <Stack gap={1}>
        <Label htmlFor={id}>{label}</Label>
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
        className={cx(TRACK, isOn ? 'bg-action' : 'bg-hairline')}
      >
        <span aria-hidden="true" className={cx('size-4 rounded-sm bg-cream transition-transform', isOn && 'translate-x-4')} />
      </button>
    </div>
  );
}
