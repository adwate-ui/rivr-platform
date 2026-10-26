import { Button } from '../Button/Button.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { BandIntro } from '../internal/bandIntro.tsx';
import { cx } from '../internal/classes.ts';
import { Text } from '../Text/Text.tsx';

/** One card: a line above (`01`, `Tier I · 1× points`), its title, a line or two, points, and a link to a page. */
export interface WebCard {
  readonly label?: string | undefined;
  readonly title: string;
  readonly text?: string | undefined;
  readonly points?: readonly string[] | undefined;
  readonly link?: { readonly label: string; readonly href: string } | undefined;
}

export interface CardsBlockProps {
  eyebrow?: string | undefined;
  heading?: string | undefined;
  intro?: string | undefined;
  cards: readonly WebCard[];
  /** A line set apart beneath the cards. */
  quote?: string | undefined;
  /** The band's one gold action, a link into the player app. */
  action?: { readonly label: string; readonly href: string } | undefined;
}

function Card({ card }: { card: WebCard }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-hairline p-6">
      {card.label ? <Text variant="eyebrow" tone="accent">{card.label}</Text> : null}
      <Heading level={3} variant="subsection">{card.title}</Heading>
      {card.text ? <Text tone="muted">{card.text}</Text> : null}
      {card.points && card.points.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {card.points.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
              <Text as="span">{point}</Text>
            </li>
          ))}
        </ul>
      ) : null}
      {card.link ? <Button variant="text" href={card.link.href}>{card.link.label}</Button> : null}
    </li>
  );
}

/**
 * A website block of cards (decision 0166), as grandpokerarena.com lays out what it stands for, its room,
 * its tiers, the steps to join and what's on: three across, or two for two or four cards, one on a phone.
 */
export function CardsBlock({ eyebrow, heading, intro, cards, quote, action }: CardsBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-10 px-6 py-16 tablet:py-24">
      <BandIntro eyebrow={eyebrow} heading={heading} intro={intro} />
      <ul className={cx('grid grid-cols-1 gap-4', cards.length % 2 === 0 && cards.length <= 4 ? 'tablet:grid-cols-2' : 'tablet:grid-cols-3')}>
        {cards.map((card) => <Card key={card.title} card={card} />)}
      </ul>
      {quote ? <p className="max-w-text font-display text-28 italic leading-snug text-content">{quote}</p> : null}
      {action ? <div><Button variant="primary" size="large" href={action.href}>{action.label}</Button></div> : null}
    </section>
  );
}
