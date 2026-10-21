import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { HeroBlock } from './HeroBlock.tsx';

const VIDEO = { src: '/media/hero-room.mp4', poster: '/media/hero-room.webp' };

describe('HeroBlock', () => {
  it('gives the page its heading, its line, and the action as a link', () => {
    renderIn(<HeroBlock eyebrow="RIVR Poker Club" heading="Bring your poker face." text="Opens Sunday 15 November." action={{ label: 'Join RIVR', href: 'https://player.invalid/sign-in?ref=FRIEND1' }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Bring your poker face.' })).toBeInTheDocument();
    expect(screen.getByText('RIVR Poker Club')).toBeInTheDocument();
    expect(screen.getByText('Opens Sunday 15 November.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join RIVR' })).toHaveAttribute('href', 'https://player.invalid/sign-in?ref=FRIEND1');
  });

  it('loops the room muted over its still, and says it is a visualisation', () => {
    const { container } = renderIn(<HeroBlock heading="Bring your poker face." video={VIDEO} note="Concept visualisation" />);
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('src', '/media/hero-room.mp4');
    expect(video?.muted).toBe(true);
    expect(video).toHaveAttribute('data-web-video');
    expect(container.querySelector('img')).toHaveAttribute('src', '/media/hero-room.webp');
    expect(screen.getByText('Concept visualisation')).toBeInTheDocument();
  });

  it('leaves the line, the action and the video out when it has none', () => {
    const { container } = renderIn(<HeroBlock heading="RIVR Poker Club" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<HeroBlock heading="RIVR Poker Club" action={{ label: 'Join RIVR', href: '#sign-in' }} video={VIDEO} note="Concept visualisation" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
