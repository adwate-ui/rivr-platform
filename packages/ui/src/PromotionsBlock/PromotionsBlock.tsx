import { Heading } from '../Heading/Heading.tsx';
import { Text } from '../Text/Text.tsx';

/** A live promotion, as published: its title, what it gives, and who and when. */
export interface WebPromotion {
  readonly title: string;
  readonly detail?: string | undefined;
  readonly runs?: string | undefined;
}

export interface PromotionsBlockProps {
  heading?: string | undefined;
  promotions: readonly WebPromotion[];
  /** What the block says while none runs: "No promotions are running just now." */
  emptyText: string;
}

/**
 * A website block of the club's live promotions (decision 0166), a card each, as the TV and Home show
 * them (#86): the title, what it gives, and who and when.
 */
export function PromotionsBlock({ heading, promotions, emptyText }: PromotionsBlockProps) {
  return (
    <section className="mx-auto flex max-w-console flex-col gap-10 px-6 py-16 tablet:py-24">
      {heading ? <Heading level={2} variant="band">{heading}</Heading> : null}
      {promotions.length === 0 ? <Text tone="muted">{emptyText}</Text> : (
        <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
          {promotions.map((promotion) => (
            <li key={promotion.title} className="flex flex-col gap-3 rounded-lg border border-hairline p-6">
              <Heading level={3} variant="subsection">{promotion.title}</Heading>
              {promotion.detail ? <Text>{promotion.detail}</Text> : null}
              {promotion.runs ? <Text variant="small" tone="accent">{promotion.runs}</Text> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
