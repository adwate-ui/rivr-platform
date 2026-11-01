import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
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
  /** Each tile rises into place in turn, then the tagline: the logo animation, drawn to MP4 by @rivr/render. */
  isAnimated?: boolean;
}

const TILE: Record<WordmarkSize, string> = {
  md: 'h-8 w-6 rounded-sm text-20',
  lg: 'h-16 w-12 rounded-md text-44',
};

const TAGLINE: Record<WordmarkSize, string> = { md: 'text-12', lg: 'text-20' };

const SPADE: Record<WordmarkSize, number> = { md: tokens.icon.size.sm, lg: tokens.icon.size.xl };

const ALIGN = { start: 'items-start', center: 'items-center' } as const;

/**
 * The brand's spade on a 24-unit grid: a pointed crown, two full lobes, a fine waist and a flared foot, as on a playing card.
 * Drawn here because lucide's spade is an outline whose stem is a stroke, so filled it lost its stem and read as an inverted
 * heart (UI polish audit AS-04). The brand's designer's master replaces it when it is given.
 */
const SPADE_PATH = 'M12 1.5C12 1.5 3 8.5 3 13.5C3 16.3 5.2 18.2 7.8 18.2C9.5 18.2 10.9 17.4 11.5 16.3C11.3 18.6 10.3 20.6 8.5 22'
  + 'L15.5 22C13.7 20.6 12.7 18.6 12.5 16.3C13.1 17.4 14.5 18.2 16.2 18.2C18.8 18.2 21 16.3 21 13.5C21 8.5 12 1.5 12 1.5Z';

function SpadeMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={SPADE_PATH} />
    </svg>
  );
}

/** The mark's last tile: the red card with the cream spade. Alone, it is the app icon (BrandArt). */
export function WordmarkCard({ size = 'md', revealStep }: { size?: WordmarkSize; revealStep?: number | undefined }) {
  return (
    <span data-reveal={revealStep} className={cx('flex items-center justify-center bg-alert text-on-alert', TILE[size])}>
      <SpadeMark size={SPADE[size]} />
    </span>
  );
}

/**
 * The brand mark: R I V R as cream tiles with ink serif capitals, then a red card with a
 * cream spade. The one place a filled shape and the red card appear.
 */
export function Wordmark({ size = 'md', withTagline = false, withMotto = false, align = 'start', isAnimated = false }: WordmarkProps) {
  const tile = cx('flex items-center justify-center', TILE[size]);
  const letters = [...t('ui.brand.name')];
  // The step each part rises at: the letters, then the card, then the tagline.
  const step = (index: number) => (isAnimated ? index : undefined);
  const mark = (
    <div role="img" aria-label={t('ui.brand.label')} className={cx('inline-flex flex-col gap-2', ALIGN[align])}>
      <div className="flex gap-1">
        {letters.map((letter, index) => (
          <span key={index} data-reveal={step(index)} className={cx(tile, 'bg-cream font-display leading-tight text-on-cream')}>
            {letter}
          </span>
        ))}
        <WordmarkCard size={size} revealStep={step(letters.length)} />
      </div>
      {withTagline ? (
        <span data-reveal={step(letters.length + 1)} className={cx('font-text font-medium uppercase tracking-tv text-content', TAGLINE[size])}>
          {t('ui.brand.tagline')}
        </span>
      ) : null}
    </div>
  );
  if (!withMotto) return mark;
  // The motto sits outside the image so a screen reader reads it.
  return (
    <div className={cx('inline-flex flex-col gap-6', ALIGN[align])}>
      {mark}
      <p className="font-display text-24 italic leading-snug text-content-muted">
        {t('ui.brand.motto')}
      </p>
    </div>
  );
}
