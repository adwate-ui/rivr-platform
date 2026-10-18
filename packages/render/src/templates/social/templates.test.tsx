import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PromoCard } from './PromoCard.tsx';
import { TournamentPoster } from './TournamentPoster.tsx';

const VENUE = 'Upper floor, Glaza, M3M 65th Avenue, Gurugram';

describe('social templates', () => {
  it('draws a tournament without a guarantee, such as a freezeout, with no figure and no "Guaranteed"', () => {
    const html = renderToStaticMarkup(<TournamentPoster name="Monday freezeout" startsAt="2026-11-16T13:30:00Z" buyInPaise={200_000n} venue={VENUE} />);
    expect(html).toContain('Buy-in ₹2,000');
    expect(html).not.toContain('Guaranteed');
    expect(html).not.toContain('₹0');
  });

  it('shows a promotion reward that is an amount as the figure', () => {
    const html = renderToStaticMarkup(<PromoCard title="Referral bonus" rewardPaise={100_000n} runs="Every day" who="Every member" venue={VENUE} />);
    expect(html).toContain('₹1,000');
  });
});
