import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { OFFER_SLIDE_MS, OfferCarousel } from './OfferCarousel.tsx';

const HOURS = { id: 'a', title: 'Offer', offer: '1,000 Bonus after 4 hours', schedule: 'Every day, all tables' };
const HAPPY = { id: 'b', title: 'Happy hour', offer: '2-for-1 at the Glaza bar' };
const HIGH_HAND = { id: 'c', title: 'High hand bonus', offer: 'Royal flush 25,000' };
const THREE = [HOURS, HAPPY, HIGH_HAND];

/** The dot that is current: "Offer 2 of 3". */
const currentDot = () => screen.getAllByRole('button', { name: /^Offer \d of \d$/ }).find((dot) => dot.getAttribute('aria-current') === 'true')?.getAttribute('aria-label');

/** Lays the slides out 300 px apart, as a browser would (jsdom lays nothing out), and scrolls the row to `slide`. */
function scrollRowTo(slide: number) {
  const row = screen.getByRole('list');
  [...row.children].forEach((item, at) => Object.defineProperty(item, 'offsetLeft', { configurable: true, value: at * 300 }));
  Object.defineProperty(row, 'scrollLeft', { configurable: true, writable: true, value: slide * 300 });
  fireEvent.scroll(row);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('OfferCarousel', () => {
  it('is named, with no heading, shows every offer as a slide, and opens a linked one', async () => {
    const onOpen = vi.fn();
    renderIn(<OfferCarousel title="Offers" offers={[
      { id: 'a', title: 'Refer a friend', offer: '1,000 Bonus each', schedule: 'When a friend joins', onOpen },
      { id: 'b', title: 'Happy hour', offer: '2-for-1 at the Glaza bar' },
    ]} />);
    expect(screen.getByRole('region', { name: 'Offers' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Refer a friend/ }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /Happy hour/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('has a dot for each offer, the first current, and moves on every five seconds, round to the first again', () => {
    vi.useFakeTimers();
    renderIn(<OfferCarousel title="Offers" offers={THREE} />);
    expect(screen.getAllByRole('button', { name: /^Offer \d of 3$/ })).toHaveLength(3);
    expect(currentDot()).toBe('Offer 1 of 3');
    act(() => { vi.advanceTimersByTime(OFFER_SLIDE_MS); });
    expect(currentDot()).toBe('Offer 2 of 3');
    act(() => { vi.advanceTimersByTime(OFFER_SLIDE_MS); });
    expect(currentDot()).toBe('Offer 3 of 3');
    act(() => { vi.advanceTimersByTime(OFFER_SLIDE_MS); });
    expect(currentDot()).toBe('Offer 1 of 3');
  });

  it('holds the slide whose dot is tapped', () => {
    vi.useFakeTimers();
    renderIn(<OfferCarousel title="Offers" offers={THREE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Offer 3 of 3' }));
    expect(currentDot()).toBe('Offer 3 of 3');
    act(() => { vi.advanceTimersByTime(OFFER_SLIDE_MS * 4); });
    expect(currentDot()).toBe('Offer 3 of 3');
  });

  it('holds the slide a swipe lands on', () => {
    vi.useFakeTimers();
    renderIn(<OfferCarousel title="Offers" offers={THREE} />);
    fireEvent.pointerDown(screen.getByRole('list'));
    scrollRowTo(1);
    expect(currentDot()).toBe('Offer 2 of 3');
    act(() => { vi.advanceTimersByTime(OFFER_SLIDE_MS * 3); });
    expect(currentDot()).toBe('Offer 2 of 3');
  });

  it('holds for a slow drag too: the finger rests, then drags', () => {
    vi.useFakeTimers();
    renderIn(<OfferCarousel title="Offers" offers={THREE} />);
    fireEvent.pointerDown(screen.getByRole('list'));
    act(() => { vi.advanceTimersByTime(3000); });
    fireEvent.touchMove(screen.getByRole('list'));
    scrollRowTo(2);
    act(() => { vi.advanceTimersByTime(OFFER_SLIDE_MS * 2); });
    expect(currentDot()).toBe('Offer 3 of 3');
  });

  it('follows its card and keeps moving when an offer coming in before it moves the row, which is no swipe', () => {
    vi.useFakeTimers();
    const { rerender } = renderIn(<OfferCarousel title="Offers" offers={[HAPPY, HIGH_HAND]} />);
    // An offer read later comes in first (Home's Refer a friend): the browser keeps Happy hour in view, now the second slide.
    rerender(<OfferCarousel title="Offers" offers={[HOURS, HAPPY, HIGH_HAND]} />);
    scrollRowTo(1);
    expect(currentDot()).toBe('Offer 2 of 3');
    act(() => { vi.advanceTimersByTime(OFFER_SLIDE_MS); });
    expect(currentDot()).toBe('Offer 3 of 3');
  });

  it('holds where it is once the focus moves into a card', () => {
    vi.useFakeTimers();
    renderIn(<OfferCarousel title="Offers" offers={[{ ...HOURS, href: 'https://glaza.example/four-hours' }, HAPPY, HIGH_HAND]} />);
    act(() => { screen.getByRole('link', { name: /1,000 Bonus after 4 hours/ }).focus(); });
    act(() => { vi.advanceTimersByTime(OFFER_SLIDE_MS * 2); });
    expect(currentDot()).toBe('Offer 1 of 3');
  });

  it('moves only when told for someone who asks for less motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), addEventListener: () => undefined, removeEventListener: () => undefined }));
    renderIn(<OfferCarousel title="Offers" offers={THREE} />);
    act(() => { vi.advanceTimersByTime(OFFER_SLIDE_MS * 2); });
    expect(currentDot()).toBe('Offer 1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Offer 2 of 3' }));
    expect(currentDot()).toBe('Offer 2 of 3');
  });

  it('shows one offer with no dots, and keeps to the last when an offer ends', () => {
    vi.useFakeTimers();
    const { rerender } = renderIn(<OfferCarousel title="Offers" offers={THREE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Offer 3 of 3' }));
    rerender(<OfferCarousel title="Offers" offers={[HOURS, HAPPY]} />);
    expect(currentDot()).toBe('Offer 2 of 2');
    rerender(<OfferCarousel title="Offers" offers={[HOURS]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('1,000 Bonus after 4 hours')).toBeInTheDocument();
  });

  // Issue 776: a promotion's card may carry a link.
  it('makes a card with an address a link that opens in a new tab', () => {
    renderIn(<OfferCarousel title="Offers" offers={[
      { id: 'a', title: 'Happy hour', offer: '2-for-1 at the Glaza bar', href: 'https://glaza.example/happy-hour' },
    ]} />);
    const card = screen.getByRole('link', { name: /Happy hour/ });
    expect(card).toHaveAttribute('href', 'https://glaza.example/happy-hour');
    expect(card).toHaveAttribute('target', '_blank');
    expect(card).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ignores an address that is not https, so the card only says its offer', () => {
    renderIn(<OfferCarousel title="Offers" offers={[{ id: 'a', title: 'Happy hour', offer: '2-for-1', href: 'javascript:alert(1)' }]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('2-for-1')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<OfferCarousel title="Offers" offers={[
      { id: 'a', title: 'Refer a friend', offer: 'Bonus each', onOpen: () => undefined },
      { id: 'b', title: 'Happy hour', offer: '2-for-1', href: 'https://glaza.example/happy-hour' },
    ]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
