import { tokens } from '@rivr/tokens';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ReferralCard, referralCardSvg } from './ReferralCard.tsx';

const text = { heading: 'Play with me at RIVR', codeLabel: 'My code', code: 'RIVR1042', footer: 'We both get a bonus.' };

describe('ReferralCard', () => {
  it('draws the code large in gold on the club green, as one SVG document', () => {
    const svg = referralCardSvg(text);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"')).toBe(true);
    expect(svg).toContain(`fill="${tokens.color.green}"`);
    expect(svg).toContain(`fill="${tokens.color.gold}">RIVR1042</text>`);
  });

  it('keeps words that look like markup as words', () => {
    expect(referralCardSvg({ ...text, heading: 'Tom & <Jerry>' })).toContain('Tom &amp; &lt;Jerry&gt;');
  });

  it('shows the card as an image that says what it is', async () => {
    const { container } = renderIn(<ReferralCard text={text} alt="Referral card with the code RIVR1042" />);
    expect(screen.getByRole('img', { name: 'Referral card with the code RIVR1042' })).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
});
