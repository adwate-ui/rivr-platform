import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { HeroBlock } from './HeroBlock.tsx';

describe('HeroBlock', () => {
  it('gives the page its heading, its line, and the action as a link', () => {
    renderIn(<HeroBlock heading="RIVR Poker Club" text="Opens Sunday 15 November." action={{ label: 'Join RIVR', href: 'https://player.invalid/sign-in?ref=FRIEND1' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'RIVR Poker Club' })).toBeInTheDocument();
    expect(screen.getByText('Opens Sunday 15 November.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join RIVR' })).toHaveAttribute('href', 'https://player.invalid/sign-in?ref=FRIEND1');
  });

  it('leaves the line and the action out when it has none', () => {
    renderIn(<HeroBlock heading="RIVR Poker Club" />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<HeroBlock heading="RIVR Poker Club" action={{ label: 'Join RIVR', href: '#sign-in' }} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
