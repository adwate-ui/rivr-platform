import { BandIntro } from '../internal/bandIntro.tsx';
import { Text } from '../Text/Text.tsx';

/** A moment on the line: when (`1996`), what (`The Supreme Court's test`), and a line on it. */
export interface TimelineItem {
  readonly when: string;
  readonly title: string;
  readonly text?: string | undefined;
  /** Where to read more, such as the judgment itself (#619): `Read the judgment`. */
  readonly link?: { readonly label: string; readonly href: string } | undefined;
}

export interface TimelineBlockProps {
  eyebrow?: string | undefined;
  heading?: string | undefined;
  intro?: string | undefined;
  items: readonly TimelineItem[];
}

/**
 * A website block of moments down a line (decision 0166), as grandpokerarena.com sets out the law behind
 * it: each when in the display face, gold, beside what happened.
 */
export function TimelineBlock({ eyebrow, heading, intro, items }: TimelineBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-10 px-6 py-16 tablet:py-24">
      <BandIntro eyebrow={eyebrow} heading={heading} intro={intro} />
      <ol className="flex max-w-text flex-col border-l border-hairline">
        {items.map((item) => (
          <li key={`${item.when}-${item.title}`} className="flex flex-col gap-2 py-4 pl-8">
            <span className="font-display text-28 leading-tight text-accent">{item.when}</span>
            <Text weight="medium">{item.title}</Text>
            {item.text ? <Text tone="muted">{item.text}</Text> : null}
            {item.link ? (
              <a href={item.link.href} aria-label={`${item.link.label}: ${item.title}`}
                className="flex min-h-touch items-center font-text text-14 text-content underline underline-offset-4">{item.link.label}</a>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
