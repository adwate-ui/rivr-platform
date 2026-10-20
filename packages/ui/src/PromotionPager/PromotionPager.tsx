import { useState } from 'react';
import { cx } from '../internal/classes.ts';
import { PromotionCard, type PromotionCardProps } from '../PromotionCard/PromotionCard.tsx';

/** One card on the pager: its id, and what PromotionCard shows. */
export interface PromotionPagerCard extends PromotionCardProps {
  id: string;
}

export interface PromotionPagerProps {
  /** Names the pager for a screen reader: "Promotions". */
  label: string;
  cards: readonly PromotionPagerCard[];
  /** Each card's place, in words, for its dot: "Promotion 2 of 3". */
  pageLabels: readonly string[];
}

/**
 * Home's promotions (#86; design prompt Home: "one promotion card at a time with a quiet pager"):
 * one card, and beneath it a dot for each, pressed to show that card; no dots for one card alone.
 */
export function PromotionPager({ label, cards, pageLabels }: PromotionPagerProps) {
  const [shown, setShown] = useState(0);
  const card = cards[Math.min(shown, cards.length - 1)];
  if (card === undefined) return null;
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <PromotionCard title={card.title} detail={card.detail} runs={card.runs} />
      {cards.length < 2 ? null : (
        <div className="flex justify-center">
          {cards.map((one, index) => (
            <button key={one.id} type="button" aria-label={pageLabels[index]} aria-current={one.id === card.id ? 'true' : undefined}
              onClick={() => setShown(index)} className="flex size-touch items-center justify-center rounded-md">
              <span className={cx('size-2 bg-content', one.id === card.id ? '' : 'opacity-hairline')} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
