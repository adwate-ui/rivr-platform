import { formatNumber } from '@rivr/i18n';
import { figureClasses, type FigureSize } from '../internal/tone.ts';

export interface NumberProps {
  /** A count: points, hands, players, entries. Use Money for amounts. */
  value: number | bigint;
  size?: FigureSize;
  tone?: 'default' | 'muted';
}

/** A count with Indian grouping and tabular figures: `18,420`. */
export function Number({ value, size = 'body', tone = 'default' }: NumberProps) {
  return <span className={figureClasses(size, tone)}>{formatNumber(value)}</span>;
}
