import { t } from '@rivr/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

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
  /** The carousel's name, read out: "Offers". It has no heading. */
  title: string;
  offers: readonly Offer[];
}

/** How long a slide shows before the next, in milliseconds. */
export const OFFER_SLIDE_MS = 5000;

// How long after a finger or the wheel on the row its scroll is still the person's swipe, in milliseconds.
const SWIPE_MS = 1500;

const CARD = 'flex min-h-offer-height w-full flex-col justify-between gap-4 rounded-card border border-gold bg-raised p-5 text-start text-content focus-visible:outline focus-visible:outline-focus';

/** What a card says; the same whether it is a link, a button or neither, with an arrow when it opens something. */
function OfferBody({ offer, opens }: { offer: Offer; opens: boolean }) {
  return (
    <>
      <span className="flex flex-col gap-2">
        <span className="font-text text-12 leading-snug font-medium tracking-wide text-accent uppercase">{offer.title}</span>
        <span className="font-display text-24 leading-tight">{offer.offer}</span>
      </span>
      <span className="flex items-center justify-between gap-3 font-text text-14 text-content-muted">
        {offer.schedule ?? ''}
        {opens ? <span className="shrink-0 text-accent"><Icon name="arrowRight" size="md" /></span> : null}
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

/** Whether the person has asked their device for less motion: the slides then change only when they say. */
function wantsLessMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The slide the row has scrolled nearest to. */
function nearestSlide(row: HTMLElement): number {
  const slides = [...row.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
  const first = slides[0]?.offsetLeft ?? 0;
  let nearest = 0;
  slides.forEach((slide, index) => {
    const nearestLeft = (slides[nearest]?.offsetLeft ?? 0) - first;
    if (Math.abs(slide.offsetLeft - first - row.scrollLeft) < Math.abs(nearestLeft - row.scrollLeft)) nearest = index;
  });
  return nearest;
}

/**
 * Scrolls the row to a slide, gently unless less motion is asked for. False when the row is already there, or cannot be
 * scrolled: it then sends no scroll to say it has arrived.
 */
function scrollToSlide(row: HTMLElement | null, index: number): boolean {
  const slide = row?.children[index];
  const first = row?.children[0];
  if (!row || !(slide instanceof HTMLElement) || !(first instanceof HTMLElement) || typeof row.scrollTo !== 'function') return false;
  const left = slide.offsetLeft - first.offsetLeft;
  if (Math.abs(row.scrollLeft - left) < 1) return false;
  row.scrollTo({ left, behavior: wantsLessMotion() ? 'auto' : 'smooth' });
  return true;
}

/** A dot for each offer, the current one a gold bar; each a 44 px target that shows its offer. */
function Dots({ ids, index, onPick }: { ids: readonly string[]; index: number; onPick: (index: number) => void }) {
  return (
    <div className="flex flex-wrap justify-center">
      {ids.map((id, dot) => (
        <button key={id} type="button" aria-label={t('ui.offerCarousel.dot', { number: dot + 1, count: ids.length })}
          aria-current={dot === index ? 'true' : undefined} onClick={() => onPick(dot)}
          className="flex size-touch items-center justify-center focus-visible:outline focus-visible:outline-focus">
          <span aria-hidden="true" className={cx('h-pip rounded-full transition-colors', dot === index ? 'w-5 bg-gold' : 'w-pip bg-cream-faint')} />
        </button>
      ))}
    </div>
  );
}

/**
 * Home's offers (redesign of 15 Nov 2026, RD-20): one card at a time, the full width, moving on every five seconds
 * through every offer, with a dot for each under it. Tapping a dot shows that offer and holds it; so does a swipe, or the
 * focus moving into a card. With less motion asked for, it moves only when told. A card with an address is a link, one that
 * opens something in the app a button; the rest only say their offer. One offer has no dots.
 */
export function OfferCarousel({ title, offers }: OfferCarouselProps) {
  const row = useRef<HTMLUListElement>(null);
  // The slide the row is scrolling to by itself, so that scroll is not read as a swipe.
  const moving = useRef<number | null>(null);
  // When a finger or the wheel last took the row: only a scroll soon after is a swipe.
  const touchedAt = useRef(Number.NEGATIVE_INFINITY);
  const [shown, setShown] = useState(0);
  const [isHeld, setHeld] = useState(false);
  const count = offers.length;
  // Fewer offers than before: the slide past the end is the last.
  const index = Math.min(shown, Math.max(0, count - 1));
  const show = useCallback((next: number) => {
    setShown(next);
    if (scrollToSlide(row.current, next)) moving.current = next;
  }, []);
  useEffect(() => {
    if (isHeld || count < 2 || wantsLessMotion()) return undefined;
    const timer = window.setInterval(() => show((index + 1) % count), OFFER_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [isHeld, count, index, show]);
  const onScroll = () => {
    const nearest = row.current === null ? index : nearestSlide(row.current);
    if (moving.current === null && nearest !== index) {
      // A swipe holds the slide it lands on. Any other scroll is the row's own, such as the browser keeping the card in view
      // when an offer read later comes in before it: the dot follows the card, and the carousel moves on.
      if (Date.now() - touchedAt.current < SWIPE_MS) setHeld(true);
      setShown(nearest);
    }
    if (nearest === moving.current) moving.current = null;
  };
  // A finger or the wheel takes the row over from a move of its own.
  const onTouch = () => {
    moving.current = null;
    touchedAt.current = Date.now();
  };
  return (
    <section aria-label={title} className="flex flex-col gap-1 px-5">
      <ul ref={row} data-offer-row className="flex snap-x snap-mandatory gap-3 overflow-x-auto"
        onScroll={onScroll} onPointerDown={onTouch} onWheel={onTouch} onFocus={() => setHeld(true)}>
        {offers.map((offer) => <li key={offer.id} className="flex w-full shrink-0 snap-start"><OfferCard offer={offer} /></li>)}
      </ul>
      {count < 2 ? null : <Dots ids={offers.map((offer) => offer.id)} index={index} onPick={(next) => { setHeld(true); show(next); }} />}
    </section>
  );
}
