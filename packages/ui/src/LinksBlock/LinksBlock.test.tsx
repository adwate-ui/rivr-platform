import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { LinksBlock } from './LinksBlock.tsx';

const LINKS = [
  { label: 'Join the waitlist', href: 'https://player.invalid/' },
  { label: 'Book RIVR Academy', href: 'https://player.invalid/academy' },
];

describe('LinksBlock', () => {
  it('shows each link in order, the first as the page\'s gold action', () => {
    renderIn(<LinksBlock links={LINKS} />);
    const links = screen.getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Join the waitlist', 'https://player.invalid/'],
      ['Book RIVR Academy', 'https://player.invalid/academy'],
    ]);
    expect(links[0]?.className).not.toEqual(links[1]?.className);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<LinksBlock heading="RIVR" links={LINKS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
