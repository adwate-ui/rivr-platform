import { useT } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { Spade } from 'lucide-react';
import { cx } from '../internal/classes.ts';

/** `md` heads the phone and console shells; `lg` heads the TV and the sign-in screen. */
export type WordmarkSize = 'md' | 'lg';

export interface WordmarkProps {
  size?: WordmarkSize;
  /** Sets "Poker club" letter-spaced beneath the tiles. */
  withTagline?: boolean;
  /** Sets the motto, "Skill runs deep.", beneath it all. Used once, on the sign-in screen. */
  withMotto?: boolean;
  /** `center` for a lockup standing alone on a screen, such as sign-in. */
  align?: 'start' | 'center';
}

const TILE: Record<WordmarkSize, string> = {
  md: 'h-8 w-6 rounded-sm text-20',
  lg: 'h-16 w-12 rounded-md text-44',
};

const TAGLINE: Record<WordmarkSize, string> = { md: 'text-12', lg: 'text-20' };

const SPADE: Record<WordmarkSize, number> = { md: tokens.icon.size.sm, lg: tokens.icon.size.xl };

const ALIGN = { start: 'items-start', center: 'items-center' } as const;

/**
 * The brand mark: R I V R as cream tiles with ink serif capitals, then a red card with a
 * cream spade. The one place a filled shape and the red card appear.
 */
export function Wordmark({ size = 'md', withTagline = false, withMotto = false, align = 'start' }: WordmarkProps) {
  const t = useT();
  const tile = cx('flex items-center justify-center', TILE[size]);
  const mark = (
    <div role="img" aria-label={t('ui.brand.label')} className={cx('inline-flex flex-col gap-2', ALIGN[align])}>
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
  if (!withMotto) return mark;
  // The motto sits outside the image so a screen reader reads it. It is English in both
  // catalogues, so it is marked English and stays italic on a Hindi page; when a Hindi motto
  // arrives, `lang` must follow the locale and Devanagari must drop the italic.
  return (
    <div className={cx('inline-flex flex-col gap-6', ALIGN[align])}>
      {mark}
      <p lang="en" className="font-display text-24 italic leading-snug text-content-muted">
        {t('ui.brand.motto')}
      </p>
    </div>
  );
}
