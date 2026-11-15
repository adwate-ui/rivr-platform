import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PromotionSlide } from './PromotionSlide.tsx';
import { WaitlistSlide } from './WaitlistSlide.tsx';

describe('TV slides', () => {
  it('names a promotion slide\'s place in the rotation, and shows no pager for one alone', () => {
    expect(renderToStaticMarkup(<PromotionSlide title="High hands" position={{ current: 2, count: 3 }} />)).toContain('aria-label="Promotion 2 of 3"');
    expect(renderToStaticMarkup(<PromotionSlide title="High hands" position={{ current: 1, count: 1 }} />)).not.toContain('Promotion 1 of 1');
  });

  it('says when no one waits', () => {
    expect(renderToStaticMarkup(<WaitlistSlide stakes={[{ id: 'a', stake: 'NLH 50/100', detail: '1 table open', places: [] }]} />)).toContain('No one waiting.');
  });

  it('says how many more wait than the board holds', () => {
    const places = Array.from({ length: 9 }, (_, index) => ({ id: String(index), place: String(index + 1), name: `Player ${index + 1}` }));
    expect(renderToStaticMarkup(<WaitlistSlide stakes={[{ id: 'a', stake: 'NLH 50/100', detail: '1 table open', places }]} />)).toMatch(/\+\d+ more/);
  });
});
