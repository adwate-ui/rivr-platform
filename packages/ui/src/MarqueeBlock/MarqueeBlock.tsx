export interface MarqueeBlockProps {
  /** Short phrases: `Members only`, `Six tables`, `Hold your nerve`. */
  phrases: readonly string[];
}

/**
 * A website block of short phrases in a line across the page between bands (decision 0166), as
 * grandpokerarena.com runs its own: a list, each phrase after a small gold dot. It stands still: no
 * motion to stop.
 */
export function MarqueeBlock({ phrases }: MarqueeBlockProps) {
  return (
    <section className="border-y border-hairline px-6 py-6">
      <ul className="mx-auto flex max-w-console flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
        {phrases.map((phrase, index) => (
          <li key={phrase} className="flex items-center gap-6">
            {index === 0 ? null : <span aria-hidden="true" className="size-1 rounded-full bg-accent" />}
            <span className="font-text text-14 font-medium uppercase tracking-tv text-content">{phrase}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
