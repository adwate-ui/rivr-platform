import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { Icon } from '../Icon/Icon.tsx';
import MEDIA_WIDTHS from './mediaWidths.json';

/**
 * The public website's media (decision 0118): the club's own stills and room loop from `apps/web/public/media`.
 * A video sits over its still, which shows when the visitor asks for less motion (styles.css).
 */

/** How much of the screen a still spans from a tablet up; below a tablet every still spans the screen. */
export type WebImageSpan = 'full' | 'half' | 'quarter' | 'phone';

const SPAN: Record<Exclude<WebImageSpan, 'full'>, string> = { half: '50vw', quarter: '25vw', phone: `${tokens.viewport.phone.width}px` };

/** The `sizes` the browser chooses a file by, from the tokens' tablet breakpoint. */
function sizesOf(span: WebImageSpan): string {
  return span === 'full' ? '100vw' : `(min-width: ${tokens.breakpoint.tablet}px) ${SPAN[span]}, 100vw`;
}

export interface WebImageProps {
  src: string;
  alt: string;
  span: WebImageSpan;
  className: string;
  /** Loads it as it nears the screen; leave it off for an image in the first view. */
  isLazy?: boolean;
}

/**
 * A still from the website's media (UI polish audit AS-10): AVIF, then WebP, at each width in mediaWidths.json (made by
 * packages/ui/scripts/media.mjs), for the browser to choose by how much of the screen it spans; the still itself where
 * neither is understood. An address outside `/media/` shows as it is.
 */
export function WebImage({ src, alt, span, className, isLazy = true }: WebImageProps) {
  const image = <img src={src} alt={alt} loading={isLazy ? 'lazy' : undefined} decoding="async" className={className} />;
  const name = /^\/media\/([\w-]+)\.(?:webp|jpe?g|png)$/.exec(src)?.[1];
  if (name === undefined) return image;
  const sizes = sizesOf(span);
  const set = (format: 'avif' | 'webp') => MEDIA_WIDTHS.map((width) => `/media/w/${name}-${width}.${format} ${width}w`).join(', ');
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
      <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
      {image}
    </picture>
  );
}

/** Beside media that is not the room itself, as the teaser says it: `Concept visualisation`. On its own dark label, so it reads over any footage. */
export function MediaNote({ children }: { children: string }) {
  return <span className="absolute bottom-3 end-3 rounded-sm bg-green-black px-2 py-1 font-text text-12 uppercase tracking-wide text-cream">{children}</span>;
}

/**
 * A muted loop of the room, filling its frame, over its first frame, with a button that pauses it and plays it again
 * (WCAG 2.2.2). The website is plain HTML: its page's script (`Document.astro`) runs the button, `aria-pressed` while
 * paused, and keeps the choice for the visit.
 */
export function LoopingVideo({ src, poster, note }: { src: string; poster: string; note?: string | undefined }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-hairline">
      <WebImage src={poster} alt="" span="half" isLazy={false} className="absolute inset-0 size-full object-cover" />
      <video data-web-video src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" aria-hidden="true"
        className="absolute inset-0 size-full object-cover" />
      <button type="button" data-web-video-toggle aria-pressed="false" aria-label={t('ui.web.pauseVideo')}
        className="absolute start-3 bottom-3 flex size-touch items-center justify-center rounded-full bg-green-black text-cream focus-visible:outline-2 focus-visible:outline-focus">
        <span data-when-playing className="flex"><Icon name="pause" size="sm" /></span>
        <span data-when-paused hidden className="flex"><Icon name="play" size="sm" /></span>
      </button>
      {note ? <MediaNote>{note}</MediaNote> : null}
    </div>
  );
}
