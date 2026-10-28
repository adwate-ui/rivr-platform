import { describe, expect, it } from 'vitest';
import { toSpinColumns } from './SpinMode.tsx';

describe('the spin wheel board (decision 0266)', () => {
  it('shows the prizes in order with their odds, and the spins newest first, a hidden name as a member', () => {
    const [wheel, spins] = toSpinColumns({
      prizes: [{ kind: 'points', amount: 100n, weight: 3 }, { kind: 'bonus', amount: 50_000n, weight: 1 }, { kind: 'nothing', amount: 0n, weight: 1 }],
      spins: [{ name: 'Yash G.', kind: 'bonus', amount: 50_000n }, { name: null, kind: 'points', amount: 100n }],
    });
    expect(wheel?.places).toEqual([
      { id: 'prize-0', place: '1', name: '100 points', status: '3 in 5' },
      { id: 'prize-1', place: '2', name: '₹500 bonus', status: '1 in 5' },
      { id: 'prize-2', place: '3', name: 'Nothing', status: '1 in 5' },
    ]);
    expect(spins?.places).toEqual([
      { id: 'spin-0', place: '', name: 'Yash G.', status: '₹500 bonus' },
      { id: 'spin-1', place: '', name: 'A member', status: '100 points' },
    ]);
  });

  it('shows a wheel of more prizes than fit a page at a time, numbered through and saying which', () => {
    const prizes = Array.from({ length: 9 }, (_, index) => ({ kind: 'points' as const, amount: BigInt((index + 1) * 10), weight: 1 }));
    const [first] = toSpinColumns({ prizes, spins: [] });
    expect(first?.detail).toBe('Prizes 1 to 6 of 9');
    expect(first?.places).toHaveLength(6);
    const [second] = toSpinColumns({ prizes, spins: [] }, 6);
    expect(second?.detail).toBe('Prizes 7 to 9 of 9');
    expect(second?.places.map((place) => [place.place, place.name, place.status])).toEqual([
      ['7', '70 points', '1 in 9'], ['8', '80 points', '1 in 9'], ['9', '90 points', '1 in 9'],
    ]);
  });
});
