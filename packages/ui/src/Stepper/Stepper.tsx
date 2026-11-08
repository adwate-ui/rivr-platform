import { cx } from '../internal/classes.ts';

export interface StepperProps {
  /** Each step's name, in order: Sent, Preparing, On its way, Delivered. */
  steps: readonly string[];
  /** The step reached, from 0; every step up to it is gold. */
  current: number;
  /** Names the steps for a screen reader: "Order". */
  label: string;
}

/**
 * Where something stands along fixed steps (decision 0320), such as an order on its way to the seat: a short gold bar for
 * each step reached and its name beneath. The step reached is read out as the current one.
 */
export function Stepper({ steps, current, label }: StepperProps) {
  return (
    // A column for each step, however many there are (F-177).
    <ol aria-label={label} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${String(steps.length)}, minmax(0, 1fr))` }}>
      {steps.map((step, index) => {
        const isReached = index <= current;
        return (
          <li key={step} aria-current={index === current ? 'step' : undefined} className="flex flex-col gap-2">
            <span aria-hidden="true" className={cx('h-1 rounded-full transition-colors', isReached ? 'bg-gold' : 'bg-cream-track')} />
            <span className={cx('font-text text-12', isReached ? 'text-content' : 'text-content-muted')}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
