import { formatDayMonth, formatTime } from '@rivr/i18n';
import { figureClasses, type FigureSize } from '../internal/tone.ts';

export interface TimeProps {
  /** The moment, stored in UTC; it is shown in IST. */
  at: Date;
  size?: FigureSize;
  tone?: 'default' | 'muted';
  /** The clock time, `02:40`, or the day, `13 Feb`, as a movement on Balance is dated. */
  show?: 'clock' | 'day';
}

/** A clock time on the 24-hour IST clock, `02:40`, or the IST day, `13 Feb`, with a machine-readable datetime. */
export function Time({ at, size = 'body', tone = 'default', show = 'clock' }: TimeProps) {
  return (
    <time dateTime={at.toISOString()} className={figureClasses(size, tone)}>
      {show === 'day' ? formatDayMonth(at) : formatTime(at)}
    </time>
  );
}
