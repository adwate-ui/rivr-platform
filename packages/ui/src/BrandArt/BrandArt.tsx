import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { useFitScale } from '../internal/fit.ts';
import { Wordmark, WordmarkCard } from '../Wordmark/Wordmark.tsx';

/**
 * `icon`: an app icon, the red card filling its middle. `maskable`: a PWA icon that may be cut to any
 * shape, the card inside the safe circle. `adaptive`: an Android adaptive icon's foreground, the card
 * inside the safe zone. `lockup`: the wordmark and tagline, for splash screens, profile images and covers;
 * animated (`isAnimated`), the logo animation for reels and the TV.
 */
export type BrandArtKind = 'icon' | 'maskable' | 'adaptive' | 'lockup';

/**
 * Brand art for @rivr/render's brand kit: drawn once on a fixed square stage, then scaled to fit the
 * page and centred on the green, so one design serves every icon, splash and cover size crisply.
 */
export function BrandArt({ art, isAnimated = false }: { art: BrandArtKind; isAnimated?: boolean }) {
  const stage = tokens.brand[art];
  const scale = useFitScale(stage, stage);
  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-surface">
      <div className="flex shrink-0 items-center justify-center" style={{ width: stage, height: stage, transform: `scale(${scale})` }}>
        {art === 'lockup' ? (
          <Wordmark size="lg" withTagline align="center" isAnimated={isAnimated} />
        ) : (
          <div role="img" aria-label={t('ui.brand.label')}>
            <WordmarkCard size="lg" />
          </div>
        )}
      </div>
    </div>
  );
}
