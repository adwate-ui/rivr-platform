import { Fragment } from 'react';

export interface MarqueeBlockProps {
  /** Short phrases: `Members only`, `Six tables`, `Hold your nerve`. */
  phrases: readonly string[];
}

// The four suits, in turn, between the phrases.
const SUITS = ['♠', '♥', '♦', '♣'] as const;

/**
 * A website block of short phrases in a line across the page between bands (decision 0166), as
 * grandpokerarena.com runs its own, each pair kept apart by a suit. It stands still: no motion to stop.
 */
export function MarqueeBlock({ phrases }: MarqueeBlockProps) {
  return (
    <section className="border-y border-hairline px-6 py-6">
      <p className="mx-auto flex max-w-console flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
        {phrases.map((phrase, index) => (
          <Fragment key={phrase}>
            {index === 0 ? null : <span aria-hidden="true" className="text-accent">{SUITS[(index - 1) % SUITS.length]}</span>}
            <span className="font-text text-14 font-medium uppercase tracking-tv text-content">{phrase}</span>
          </Fragment>
        ))}
      </p>
    </section>
  );
}
