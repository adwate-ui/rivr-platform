import { formatTime } from '@rivr/i18n';
import { figureClasses, type FigureSize } from '../internal/tone.ts';

export interface TimeProps {
  /** The moment, stored in UTC; it is shown in IST. */
  at: Date;
  size?: FigureSize;
  tone?: 'default' | 'muted';
}

/** A clock time on the 24-hour IST clock, `02:40`, with a machine-readable datetime. */
export function Time({ at, size = 'body', tone = 'default' }: TimeProps) {
  return (
    <time dateTime={at.toISOString()} className={figureClasses(size, tone)}>
      {formatTime(at)}
    </time>
  );
}
