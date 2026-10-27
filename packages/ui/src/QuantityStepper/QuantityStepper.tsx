import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';

export interface QuantityStepperProps {
  /** What is counted, already translated, such as a menu item's name: it names the group and its buttons. */
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** 0 and 9 unless set: an order's line is 1 to 9 of an item (#123). */
  min?: number;
  max?: number;
}

/**
 * How many of something (#123): its name, then one fewer, the count, one more, each button a touch target. The count is
 * read out as it changes; a button at its limit is disabled.
 */
export function QuantityStepper({ label, value, onChange, min = 0, max = 9 }: QuantityStepperProps) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <span className="min-w-0 flex-1 font-text text-16 text-content">{label}</span>
      <Button variant="secondary" isDisabled={value <= min} aria-label={t('ui.quantity.fewer', { name: label })} onClick={() => onChange(value - 1)}>
        −
      </Button>
      <span aria-live="polite" className="w-6 text-center font-text text-16 font-medium tabular-nums text-content">{value}</span>
      <Button variant="secondary" isDisabled={value >= max} aria-label={t('ui.quantity.more', { name: label })} onClick={() => onChange(value + 1)}>
        +
      </Button>
    </div>
  );
}
