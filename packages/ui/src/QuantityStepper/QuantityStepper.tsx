import { t } from '@rivr/i18n';
import { useRef } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '../Button/Button.tsx';
import { cx } from '../internal/classes.ts';

export interface QuantityStepperProps {
  /** What is counted, already translated, such as a menu item's name: it names the group and its buttons. */
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** 0 and 9 unless set: an order's line is 1 to 9 of an item (#123). */
  min?: number;
  max?: number;
  /**
   * `round`, the redesign's 44 px circles, one more in gold, with no label beside them (decision 0320); `console`, the
   * console's row (console v3): its name at 14, and faintly filled buttons of 32 px from 1180 px, 44 px below.
   */
  look?: 'row' | 'round' | 'console';
}

interface StepperLook {
  readonly gap: string;
  /** The name's type size beside the buttons, or null with no name shown. */
  readonly label: string | null;
  readonly count: string;
  readonly fewer: ButtonVariant;
  readonly more: ButtonVariant;
  readonly shape: 'rounded' | 'pill';
  readonly size: ButtonSize;
}

const LOOKS: Record<NonNullable<QuantityStepperProps['look']>, StepperLook> = {
  row: { gap: 'gap-3', label: 'text-16', count: 'text-16', fewer: 'secondary', more: 'secondary', shape: 'rounded', size: 'regular' },
  round: { gap: 'gap-1', label: null, count: 'text-16', fewer: 'outline', more: 'primary', shape: 'pill', size: 'regular' },
  console: { gap: 'gap-2', label: 'text-14', count: 'text-14', fewer: 'subtle', more: 'subtle', shape: 'rounded', size: 'small' },
};

/**
 * How many of something (#123): its name, then one fewer, the count, one more, each button a touch target. The count is
 * read out as it changes; a button at its limit is disabled, and the press that took it there hands the focus to the
 * other button, so a keyboard is never dropped to the page (F5-07).
 */
export function QuantityStepper({ label, value, onChange, min = 0, max = 9, look = 'row' }: QuantityStepperProps) {
  const group = useRef<HTMLDivElement>(null);
  const step = (next: number) => {
    onChange(next);
    const [fewer, more] = group.current?.querySelectorAll('button') ?? [];
    if (next <= min) more?.focus();
    if (next >= max) fewer?.focus();
  };
  const chosen = LOOKS[look];
  return (
    <div ref={group} role="group" aria-label={label} className={cx('flex items-center', chosen.gap)}>
      {chosen.label === null ? null : <span className={cx('min-w-0 flex-1 font-text text-content', chosen.label)}>{label}</span>}
      <Button variant={chosen.fewer} shape={chosen.shape} size={chosen.size} isDisabled={value <= min}
        aria-label={t('ui.quantity.fewer', { name: label })} onClick={() => step(value - 1)}>
        −
      </Button>
      <span aria-live="polite" className={cx('w-6 text-center font-text font-medium tabular-nums text-content', chosen.count)}>{value}</span>
      <Button variant={chosen.more} shape={chosen.shape} size={chosen.size} isDisabled={value >= max}
        aria-label={t('ui.quantity.more', { name: label })} onClick={() => step(value + 1)}>
        +
      </Button>
    </div>
  );
}
