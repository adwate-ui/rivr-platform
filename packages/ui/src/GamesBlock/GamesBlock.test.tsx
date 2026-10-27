import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { GamesBlock, type GamesBlockGame } from './GamesBlock.tsx';

const GAMES: GamesBlockGame[] = [
  { name: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, buyInMin: 500000n, buyInMax: 500000n, straddle: null, tablesOpen: 1 },
  { name: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n, buyInMin: 1000000n, buyInMax: 4000000n, straddle: null, tablesOpen: 3, waiting: 4 },
  { name: 'Private Room', smallBlind: 10000n, bigBlind: 20000n, buyInMin: 2000000n, buyInMax: 2000000n, straddle: 50000n, tablesOpen: 0, waiting: 2 },
];

describe('GamesBlock', () => {
  it('shows each game with its stakes, buy-in and tables running', () => {
    renderIn(<GamesBlock heading="Games and stakes" games={GAMES} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Games and stakes' })).toBeInTheDocument();
    expect(screen.getByText('Buy-in ₹5,000')).toBeInTheDocument();
    expect(screen.getByText('1 table running')).toBeInTheDocument();
    expect(screen.getByText('Buy-in ₹10,000 to ₹40,000')).toBeInTheDocument();
    expect(screen.getByText('3 tables running · 4 waiting')).toBeInTheDocument();
    expect(screen.getByText('Buy-in ₹20,000 · ₹500 straddle')).toBeInTheDocument();
    expect(screen.getByText('Not running now · 2 waiting')).toBeInTheDocument();
  });

  it('says when the club has no games set up', () => {
    renderIn(<GamesBlock heading="Games and stakes" games={[]} />);
    expect(screen.getByText('No games are set up yet.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<GamesBlock heading="Games and stakes" games={GAMES} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('adds the open seats when it is given them', () => {
    renderIn(<GamesBlock heading="Games and stakes" games={[{ name: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n, buyInMin: 1000000n, buyInMax: 4000000n, straddle: null, tablesOpen: 3, waiting: 4, openSeats: 2 }]} />);
    expect(screen.getByText('3 tables running · 2 open seats · 4 waiting')).toBeInTheDocument();
  });
});
