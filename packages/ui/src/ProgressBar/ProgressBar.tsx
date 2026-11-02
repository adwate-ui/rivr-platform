import { cx } from '../internal/classes.ts';

export interface ProgressBarProps {
  /** How full, from 0 to 1. */
  fraction: number;
  /** `hold`, 200 px: a called seat's hold draining. `full`, the whole width: the way to the next reward. */
  width?: 'hold' | 'full';
}

const clamp = (fraction: number) => (Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0);

// Twenty steps are smooth enough at 200 px and keep every width a class Tailwind can find.
const STEPS = 20;
const WIDTH_CLASS = [
  'w-0', 'w-1/20', 'w-2/20', 'w-3/20', 'w-4/20', 'w-5/20', 'w-6/20', 'w-7/20', 'w-8/20', 'w-9/20', 'w-10/20',
  'w-11/20', 'w-12/20', 'w-13/20', 'w-14/20', 'w-15/20', 'w-16/20', 'w-17/20', 'w-18/20', 'w-19/20', 'w-full',
] as const;

/** A thin gold bar on a faint track (decision 0320): a seat's hold running out, or points on the way to a reward. */
export function ProgressBar({ fraction, width = 'full' }: ProgressBarProps) {
  const step = Math.round(clamp(fraction) * STEPS);
  return (
    <div aria-hidden="true" className={cx('h-1 rounded-full bg-cream-track', width === 'hold' ? 'w-hold-bar' : 'w-full')}>
      <div data-progress-fill="" className={cx('h-1 rounded-full bg-gold', WIDTH_CLASS[step])} />
    </div>
  );
}
