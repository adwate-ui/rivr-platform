import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { GamesBlock, type GamesBlockGame } from './GamesBlock.tsx';

const GAMES: GamesBlockGame[] = [
  { name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null },
  { name: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n, buyInMin: 1000000n, buyInMax: 4000000n, straddle: null },
  { name: 'Private Room', smallBlind: 10000n, bigBlind: 20000n, buyInMin: 2000000n, buyInMax: 2000000n, straddle: 50000n },
];
const RESERVE = { label: 'Reserve a seat', href: 'https://wa.me/910000000000' };

describe('GamesBlock', () => {
  it('shows each game with its stakes and buy-in, and nothing of the tables running or waiting', () => {
    renderIn(<GamesBlock heading="Games and stakes" games={GAMES} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Games and stakes' })).toBeInTheDocument();
    expect(screen.getByText('Buy-in ₹5,000')).toBeInTheDocument();
    expect(screen.getByText('Buy-in ₹10,000 to ₹40,000')).toBeInTheDocument();
    expect(screen.getByText('Buy-in ₹20,000 · ₹500 straddle')).toBeInTheDocument();
    expect(screen.queryByText(/running|waiting|open seat/)).toBeNull();
  });

  it('offers a way to reserve a seat, while the club has games', () => {
    renderIn(<GamesBlock heading="Games and stakes" games={GAMES} reserve={RESERVE} />);
    expect(screen.getByRole('link', { name: 'Reserve a seat' })).toHaveAttribute('href', 'https://wa.me/910000000000');
  });

  it('says when the club has no games set up, with nothing to reserve', () => {
    renderIn(<GamesBlock heading="Games and stakes" games={[]} reserve={RESERVE} />);
    expect(screen.getByText('No games are set up yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<GamesBlock heading="Games and stakes" games={GAMES} reserve={RESERVE} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
