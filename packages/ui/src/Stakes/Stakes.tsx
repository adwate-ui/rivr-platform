import { formatStakes } from '@rivr/i18n';
import { figureClasses, type FigureSize } from '../internal/tone.ts';

export interface StakesProps {
  /** Small blind in paise. */
  smallBlind: bigint;
  /** Big blind in paise. */
  bigBlind: bigint;
  size?: FigureSize;
  tone?: 'default' | 'muted';
}

/** A cash game's stakes written as blinds in rupees: `100/200`. */
export function Stakes({ smallBlind, bigBlind, size = 'body', tone = 'default' }: StakesProps) {
  return <span className={figureClasses(size, tone)}>{formatStakes(smallBlind, bigBlind)}</span>;
}
