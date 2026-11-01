import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { useFitScale } from '../internal/fit.ts';
import { Wordmark, WordmarkCard } from '../Wordmark/Wordmark.tsx';

/**
 * `icon`: an app icon, the red card filling its middle. `maskable`: a PWA icon that may be cut to any
 * shape, the card inside the safe circle. `adaptive`: an Android adaptive icon's foreground, the card
 * inside the safe zone. `lockup`: the wordmark and tagline, for splash screens, profile images and covers;
 * animated (`isAnimated`), the logo animation for reels and the TV. `share`: the image a shared link shows, the lockup
 * on the green beside `backdrop`, a photograph of the game (UI polish audit AS-09).
 */
export type BrandArtKind = 'icon' | 'maskable' | 'adaptive' | 'lockup' | 'share';

/**
 * Brand art for @rivr/render's brand kit: drawn once on a fixed square stage, then scaled to fit the
 * page and centred on the green, so one design serves every icon, splash and cover size crisply.
 */
export function BrandArt({ art, isAnimated = false, backdrop }: { art: BrandArtKind; isAnimated?: boolean; backdrop?: string }) {
  if (art === 'share') return <ShareArt backdrop={backdrop ?? ''} />;
  return <StageArt art={art} isAnimated={isAnimated} />;
}

/** A shared link's image: the lockup on the green, scaled to fill its half, and the photograph beside it, cropped to fill. */
function ShareArt({ backdrop }: { backdrop: string }) {
  const stage = tokens.brand.lockup;
  // The lockup's stage fits the left half: a stage twice as wide fits the whole page.
  const scale = useFitScale(stage * 2, stage);
  return (
    <div className="grid h-dvh w-full grid-cols-2 overflow-hidden bg-surface">
      <div className="flex items-center justify-center overflow-hidden">
        <div className="flex shrink-0 items-center justify-center" style={{ width: stage, height: stage, transform: `scale(${scale})` }}>
          <Wordmark size="lg" withTagline align="center" />
        </div>
      </div>
      <img src={backdrop} alt="" className="size-full object-cover" />
    </div>
  );
}

function StageArt({ art, isAnimated }: { art: Exclude<BrandArtKind, 'share'>; isAnimated: boolean }) {
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
