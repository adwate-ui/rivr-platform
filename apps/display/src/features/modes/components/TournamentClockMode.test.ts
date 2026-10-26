import type { LiveTournament } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { toClockProps } from './TournamentClockMode.tsx';

const SUNDAY: LiveTournament = {
  name: 'RIVR Sunday',
  stages: [
    { kind: 'level', smallBlind: 400, bigBlind: 800, ante: 800, minutes: 20 },
    { kind: 'break', minutes: 10 },
    { kind: 'level', smallBlind: 500, bigBlind: 1000, ante: 1000, minutes: 20 },
  ],
  clock: { elapsedSeconds: 500, isRunning: true, readAtMs: 1_000_000 },
  field: { entries: 58, playersLeft: 31, chipsInPlay: 58 * 30_000, pool: fromPaise(52_200_000n) },
};

describe('the TV’s tournament clock (decision 0201)', () => {
  it('shows the level, its time left, blinds, ante and the next level', () => {
    expect(toClockProps(SUNDAY, 500)).toMatchObject({
      name: 'RIVR Sunday', level: 'Level 1', remaining: '11:40', blinds: '400/800', ante: 'Ante 800', next: 'Next 500/1,000 ante 1,000', status: undefined,
    });
    expect(toClockProps(SUNDAY, 505).remaining).toBe('11:35');
  });

  it('shows a break after its level, with the next level’s blinds', () => {
    const onBreak = toClockProps(SUNDAY, 1500);
    expect(onBreak).toMatchObject({ level: 'Break after level 1', blinds: 'Break', ante: undefined, remaining: '05:00', next: 'Next 500/1,000 ante 1,000' });
  });

  it('shows the field under the clock, as the design prompt has it', () => {
    expect(toClockProps(SUNDAY, 500).stats).toEqual([
      { label: 'Players', value: '31' }, { label: 'Entries', value: '58' }, { label: 'Average', value: '56,129' }, { label: 'Pool', value: '₹5,22,000' },
    ]);
  });

  it('holds while paused, and shows no next level on the last', () => {
    const paused = toClockProps({ ...SUNDAY, clock: { elapsedSeconds: 1800, isRunning: false, readAtMs: 1_000_000 } }, 1800);
    expect(paused).toMatchObject({ level: 'Level 2', remaining: '20:00', status: 'Paused', next: undefined });
  });
});
