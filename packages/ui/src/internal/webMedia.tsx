/**
 * The public website's media (decision 0118): the club's own stills and room loop from `apps/web/public/media`.
 * A video sits over its still, which shows when the visitor asks for less motion (styles.css).
 */

/** Beside media that is not the room itself, as the teaser says it: `Concept visualisation`. */
export function MediaNote({ children }: { children: string }) {
  return <span className="absolute bottom-3 end-3 font-text text-12 uppercase tracking-wide text-cream opacity-muted">{children}</span>;
}

/** A muted loop of the room, filling its frame, over its first frame. */
export function LoopingVideo({ src, poster, note }: { src: string; poster: string; note?: string | undefined }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-hairline">
      <img src={poster} alt="" className="absolute inset-0 size-full object-cover" />
      <video data-web-video src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" aria-hidden="true"
        className="absolute inset-0 size-full object-cover" />
      {note ? <MediaNote>{note}</MediaNote> : null}
    </div>
  );
}
