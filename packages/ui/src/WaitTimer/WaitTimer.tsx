import { formatCountdown, t } from '@rivr/i18n';
import { cx } from '../internal/classes.ts';

export interface WaitTimerProps {
  /** Whole seconds waited so far; the screen counts them up. */
  seconds: number;
  /** Past this many seconds it is late: a red marker that says so. */
  lateAfter: number;
}

/**
 * How long something has waited, as a clock, such as a top-up a member asked for (decision 0299): muted while in time,
 * and past `lateAfter` a red marker reading "Late", so it does not rest on the colour alone.
 */
export function WaitTimer({ seconds, lateAfter }: WaitTimerProps) {
  const isLate = seconds > lateAfter;
  const clock = formatCountdown(seconds);
  return (
    <span className={cx('inline-flex items-center rounded-md px-2 font-text text-14 font-medium tabular-nums',
      isLate ? 'bg-alert text-on-alert' : 'text-content-muted')}>
      {isLate ? t('ui.waitTimer.late', { time: clock }) : clock}
    </span>
  );
}
