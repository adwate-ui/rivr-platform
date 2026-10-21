import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

/** One tile: the club's still, what it shows for a screen reader, its title and a line. */
export interface GalleryBlockItem {
  readonly image: string;
  readonly alt: string;
  readonly title: string;
  readonly text?: string | undefined;
}

export interface GalleryBlockProps {
  eyebrow?: string | undefined;
  heading?: string | undefined;
  intro?: string | undefined;
  items: readonly GalleryBlockItem[];
  /** Beneath the tiles, as the teaser says it: `Concept visualisation`. */
  note?: string | undefined;
}

/**
 * A website block of photo tiles (#441): what the club does for its members, each tile's title over a
 * darkened foot of its still, four across on a wide screen and one on a phone.
 */
export function GalleryBlock({ eyebrow, heading, intro, items, note }: GalleryBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-10 px-6 py-16 tablet:py-24">
      {eyebrow || heading || intro ? (
        <div className="flex flex-col gap-6 tablet:flex-row tablet:items-end tablet:justify-between">
          <div className="flex flex-col gap-4">
            {eyebrow ? <Text variant="eyebrow" tone="accent">{eyebrow}</Text> : null}
            {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
          </div>
          {intro ? (
            <div className="max-w-text">
              <Text variant="lead" tone="muted">{intro}</Text>
            </div>
          ) : null}
        </div>
      ) : null}
      <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-4">
        {items.map((item) => (
          <li key={item.title} className="relative aspect-photo overflow-hidden rounded-lg">
            <img src={item.image} alt={item.alt} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-green-black px-4 pt-16 pb-4">
              <h3 className="font-display text-24 leading-tight text-cream">{item.title}</h3>
              {item.text ? <p className="font-text text-14 leading-snug text-cream opacity-muted">{item.text}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      {note ? <Text variant="caption" tone="muted">{note}</Text> : null}
    </section>
  );
}
