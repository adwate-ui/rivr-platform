import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CLOCK } from '../../test/tv.ts';
import { BadBeatJackpotSlide } from '../BadBeatJackpotSlide.tsx';
import { PromotionSlide } from './PromotionSlide.tsx';
import { TournamentClockSlide } from './TournamentClockSlide.tsx';
import { WaitlistSlide } from './WaitlistSlide.tsx';

describe('TV slides', () => {
  it('words the tournament clock: level, time left, blinds in chips, the next level and the pool', () => {
    const html = renderToStaticMarkup(<TournamentClockSlide {...CLOCK} />);
    for (const text of ['RIVR Sunday', 'Level 7', '11:29', '400/800', 'Ante 800', 'Next 500/1,000 ante 1,000', '56,129', '₹5,22,000', '₹1,56,600']) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain('Paused');
  });

  it('says when the clock is paused, leaves out an ante there is not, and words the last level and unset payouts', () => {
    const html = renderToStaticMarkup(
      <TournamentClockSlide {...CLOCK} isPaused blinds={{ small: 100, big: 200, ante: 0 }} next={{ small: 200, big: 400, ante: 0 }} payoutsPaise={[]} />,
    );
    expect(html).toContain('Paused');
    expect(html).not.toContain('Ante');
    expect(html).toContain('Next 200/400<');
    expect(html).toContain('Payouts are set when registration closes.');
    expect(renderToStaticMarkup(<TournamentClockSlide {...CLOCK} next={undefined} />)).not.toContain('Next');
  });

  it('names a promotion slide\'s place in the rotation, and shows no pager for one alone', () => {
    expect(renderToStaticMarkup(<PromotionSlide title="High hands" position={{ current: 2, count: 3 }} />)).toContain('aria-label="Promotion 2 of 3"');
    expect(renderToStaticMarkup(<PromotionSlide title="High hands" position={{ current: 1, count: 1 }} />)).not.toContain('Promotion 1 of 1');
  });

  it('says when no one waits, and before a high hand tonight', () => {
    expect(renderToStaticMarkup(<WaitlistSlide stakes={[{ id: 'a', stake: 'NLH 50/100', detail: '1 table open', places: [] }]} />)).toContain('No one waiting.');
    expect(renderToStaticMarkup(<BadBeatJackpotSlide amountPaise={34_260_000n} />)).toContain('No high hand yet tonight.');
  });
});
