import { Icon } from '../Icon/Icon.tsx';

/** One offer: its name (the eyebrow), what it gives, when it runs, and where a tap goes, if anywhere. */
export interface Offer {
  readonly id: string;
  /** "Happy hour". */
  readonly title: string;
  /** "2-for-1 at the Glaza bar". */
  readonly offer: string;
  /** "Daily, 19:00 to 21:00". */
  readonly schedule?: string | undefined;
  /** Opens what the offer links to in the app: the card is then a button. */
  readonly onOpen?: (() => void) | undefined;
  /** An https address the card opens in a new tab (#776): the card is then a link, before `onOpen`. Any other address is ignored. */
  readonly href?: string | undefined;
}

export interface OfferCarouselProps {
  /** "Tonight". */
  title: string;
  /** "3 offers". */
  countLabel: string;
  offers: readonly Offer[];
}

const CARD = 'flex min-h-offer-height w-offer shrink-0 snap-start flex-col justify-between gap-4 rounded-card border border-gold bg-raised p-5 text-start text-content';

/** What a card says; the same whether it is a link, a button or neither, with an arrow when it opens something. */
function OfferBody({ offer, opens }: { offer: Offer; opens: boolean }) {
  return (
    <>
      <span className="flex flex-col gap-2">
        <span className="font-text text-12 leading-snug font-medium tracking-wide text-accent uppercase">{offer.title}</span>
        <span className="font-display text-28 leading-tight">{offer.offer}</span>
      </span>
      <span className="flex items-center justify-between font-text text-13 text-content-muted">
        {offer.schedule ?? ''}
        {opens ? <span className="text-accent"><Icon name="arrowRight" size="md" /></span> : null}
      </span>
    </>
  );
}

/** A card: a link when it has an https address, a button when it opens something in the app, otherwise only its words. */
function OfferCard({ offer }: { offer: Offer }) {
  if (offer.href?.startsWith('https://')) {
    return <a className={CARD} href={offer.href} target="_blank" rel="noopener noreferrer"><OfferBody offer={offer} opens /></a>;
  }
  if (offer.onOpen) return <button type="button" className={CARD} onClick={offer.onOpen}><OfferBody offer={offer} opens /></button>;
  return <div className={CARD}><OfferBody offer={offer} opens={false} /></div>;
}

/**
 * Tonight's offers (decision 0320): the title and how many, then 300 by 168 cards in a row that scrolls sideways and snaps
 * to each card. A card with an address is a link, one that opens something in the app a button; the rest only say their offer.
 */
export function OfferCarousel({ title, countLabel, offers }: OfferCarouselProps) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-5">
        <h2 className="font-display text-32 leading-tight text-content">{title}</h2>
        <span className="font-text text-13 text-content-muted">{countLabel}</span>
      </div>
      <ul className="flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5">
        {offers.map((offer) => (
          <li key={offer.id} className="flex">
            <OfferCard offer={offer} />
          </li>
        ))}
      </ul>
    </section>
  );
}
