import { cx } from '../internal/classes.ts';

export interface ProgressBarProps {
  /** How full, from 0 to 1. */
  fraction: number;
  /** `hold`, 200 px: a called seat's hold draining. `full`, the whole width: the way to the next reward. */
  width?: 'hold' | 'full';
  /** `gold`, something on its way to the member; `muted`, cream at 60%, a call time running on the console, which needs nobody (decision 0429). */
  tone?: 'gold' | 'muted';
}

const clamp = (fraction: number) => (Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0);

/**
 * A thin gold bar on a faint track (decision 0320): a seat's hold running out, or points on the way to a reward. The fill
 * is scaled to the fraction and moves linearly over each second's tick (brief 2.6), so a hold drains, never jumps.
 */
export function ProgressBar({ fraction, width = 'full', tone = 'gold' }: ProgressBarProps) {
  return (
    <div aria-hidden="true" className={cx('h-1 overflow-hidden rounded-full bg-cream-track', width === 'hold' ? 'w-hold-bar' : 'w-full')}>
      <div data-progress-fill="" className={cx('h-1 w-full origin-left rounded-full', tone === 'gold' ? 'bg-gold' : 'bg-content-muted')} style={{ transform: `scaleX(${String(clamp(fraction))})` }} />
    </div>
  );
}
