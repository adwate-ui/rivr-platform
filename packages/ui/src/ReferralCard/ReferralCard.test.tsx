import { tokens } from '@rivr/tokens';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { cardFontIn, ReferralCard, referralCardSvg } from './ReferralCard.tsx';

const text = { brand: 'RIVR', heading: 'Play with me at RIVR', codeLabel: 'My code', code: 'RIVR1042', footer: 'We both get a bonus.' };

describe('ReferralCard', () => {
  it('draws the code large in gold on the club green, as one SVG document', () => {
    const svg = referralCardSvg(text);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"')).toBe(true);
    expect(svg).toContain(`fill="${tokens.color.green}"`);
    expect(svg).toContain(`fill="${tokens.color.gold}">RIVR1042</text>`);
  });

  it('is a size.shareCard square, with the club name as the app gives it', () => {
    const svg = referralCardSvg({ ...text, brand: 'RIVR Poker Club' });
    expect(svg).toContain(`width="${tokens.size.shareCard}" height="${tokens.size.shareCard}"`);
    expect(svg).toContain('>RIVR Poker Club</text>');
  });

  it('carries the display face when given it, so a phone never draws the card in its fallback serif', () => {
    const svg = referralCardSvg(text, 'data:font/woff2;base64,d09GMg==');
    expect(svg).toContain('@font-face{font-family:"RIVR Card";font-weight:400 900;src:url(data:font/woff2;base64,d09GMg==)');
    expect(svg).toContain('font-family="RIVR Card, Bodoni Moda, serif"');
    expect(referralCardSvg(text)).not.toContain('@font-face');
  });

  it('takes the display face\'s upright Latin file from the page\'s rules, as a browser writes them', () => {
    const base = 'https://club.invalid/assets/styles.css';
    const face = (style: string, range: string, file: string) =>
      `@font-face { font-family: "Bodoni Moda"; font-style: ${style}; font-weight: 400 900; src: url("../fonts/${file}") format("woff2-variations"); unicode-range: ${range}; }`;
    expect(cardFontIn([
      { cssText: '@font-face { font-family: "Instrument Sans"; src: url("/fonts/sans.woff2"); unicode-range: U+0-FF; }', base },
      { cssText: face('italic', 'U+0-FF, U+131', 'latin-italic.woff2'), base },
      { cssText: face('normal', 'U+100-2BA, U+2BD-2C5', 'latin-ext.woff2'), base },
      { cssText: face('normal', 'U+20B9', 'rupee.woff2'), base },
      { cssText: face('normal', 'U+0-FF, U+131, U+152-153', 'latin.woff2'), base },
    ])).toBe('https://club.invalid/fonts/latin.woff2');
    expect(cardFontIn([{ cssText: face('normal', 'U+20B9', 'rupee.woff2'), base }])).toBeNull();
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
