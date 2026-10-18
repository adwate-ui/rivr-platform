import { formatMoney } from '@rivr/i18n';
import { figureClasses, type FigureSize } from '../internal/tone.ts';

/** `player` is gold: money that belongs to the member looking at it. */
export type MoneyTone = 'default' | 'muted' | 'player';

export interface MoneyProps {
  /** The amount in integer paise, as every amount in RIVR is stored. */
  paise: bigint;
  size?: FigureSize;
  tone?: MoneyTone;
}

const TONE = { default: 'default', muted: 'muted', player: 'money' } as const;

/** An amount of money, `₹1,20,000`: Indian grouping, tabular figures, never rounded. */
export function Money({ paise, size = 'body', tone = 'default' }: MoneyProps) {
  return <span className={figureClasses(size, TONE[tone])}>{formatMoney(paise)}</span>;
}
