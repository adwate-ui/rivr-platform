import { useT } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { Spade } from 'lucide-react';
import { cx } from '../internal/classes.ts';

/** `md` heads the phone and console shells; `lg` heads the TV. */
export type WordmarkSize = 'md' | 'lg';

export interface WordmarkProps {
  size?: WordmarkSize;
  /** Sets "Poker club" letter-spaced beneath the tiles. */
  withTagline?: boolean;
}

const TILE: Record<WordmarkSize, string> = {
  md: 'h-8 w-6 rounded-sm text-20',
  lg: 'h-16 w-12 rounded-md text-44',
};

const TAGLINE: Record<WordmarkSize, string> = { md: 'text-12', lg: 'text-20' };

const SPADE: Record<WordmarkSize, number> = { md: tokens.icon.size.sm, lg: tokens.icon.size.xl };

/**
 * The brand mark: R I V R as cream tiles with ink serif capitals, then a red card with a
 * cream spade. The one place a filled shape and the red card appear.
 */
export function Wordmark({ size = 'md', withTagline = false }: WordmarkProps) {
  const t = useT();
  const tile = cx('flex items-center justify-center', TILE[size]);
  return (
    <div role="img" aria-label={t('ui.brand.label')} className="inline-flex flex-col items-start gap-2">
      <div className="flex gap-1">
        {[...t('ui.brand.name')].map((letter, index) => (
          <span key={index} className={cx(tile, 'bg-cream font-display leading-tight text-on-cream')}>
            {letter}
          </span>
        ))}
        <span className={cx(tile, 'bg-alert text-on-alert')}>
          <Spade size={SPADE[size]} fill="currentColor" strokeWidth={0} aria-hidden="true" />
        </span>
      </div>
      {withTagline ? (
        <span className={cx('font-text font-medium uppercase tracking-tv text-content hindi:tracking-normal', TAGLINE[size])}>
          {t('ui.brand.tagline')}
        </span>
      ) : null}
    </div>
  );
}
