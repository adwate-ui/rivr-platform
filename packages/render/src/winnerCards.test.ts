import type { WinnerCardRow } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { pngSize } from './test/png.ts';
import { drawWinnerCard, highHandCardProps, winnerCardProps } from './winnerCards.ts';

const VENUE = 'Upper floor, Glaza, M3M 65th Avenue, Gurugram';
const row = (kind: WinnerCardRow['kind'], details: WinnerCardRow['details']): WinnerCardRow => ({
  card_id: '00000000-0000-4000-8000-0000000009c1', venue_id: '00000000-0000-4000-8000-000000000001', kind, player_name: 'Kavya R.',
  venue_address: VENUE, details, prize_paise: 12_000_000, won_at: '2026-11-15T20:10:00+00:00',
});

describe('winner cards', () => {
  it('draws a tournament win as the winner card: who, the tournament, the prize, when and where', () => {
    expect(winnerCardProps(row('tournament', { event_name: 'Weeknight Turbo' }))).toEqual({
      playerName: 'Kavya R.', eventName: 'Weeknight Turbo', prizePaise: 12_000_000n, wonAt: '2026-11-15T20:10:00+00:00', venue: VENUE,
    });
  });

  it('names a jackpot share as the bad-beat jackpot', () => {
    expect(winnerCardProps(row('jackpot', {})).eventName).toBe('Bad-beat jackpot');
  });

  it('draws a high hand as the high-hand card, the hand named as on the TV', () => {
    expect(highHandCardProps(row('high_hand', { category: 'four_of_a_kind', rank: 'A', table_name: 'Table 2' }))).toEqual({
      hand: 'Four of a kind, Aces', playerName: 'Kavya R.', tableName: 'Table 2', bonusPaise: 12_000_000n, at: '2026-11-15T20:10:00+00:00', venue: VENUE,
    });
    expect(highHandCardProps(row('high_hand', { category: 'royal_flush', rank: null, table_name: 'Table 2' })).hand).toBe('Royal flush');
  });

  it('draws each as a feed post, 4:5', async () => {
    expect(pngSize(Buffer.from(await drawWinnerCard(row('tournament', { event_name: 'Weeknight Turbo' }))))).toEqual({ chunk: 'IHDR', width: 1080, height: 1350 });
  });
});
