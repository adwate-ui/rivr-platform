import { describe, expect, it } from 'vitest';
import { floorSeatHref, tonightByMember } from './tonight.ts';

const TABLES = [{ id: 't2', name: 'Table 2' }];

describe('tonightByMember', () => {
  it('puts a seated member at their table and seat, over what the day list says', () => {
    const tonight = tonightByMember([{ memberId: 'm1', tableId: 't2', seat: 3 }], TABLES, [{ memberId: 'm1', status: 'playing' }]);
    expect(tonight.get('m1')).toEqual({ kind: 'seated', tableId: 't2', tableName: 'Table 2', seat: 3 });
  });

  it('says waiting or left from the day list, and nothing for a member not at the club today', () => {
    const tonight = tonightByMember([], TABLES, [{ memberId: 'm2', status: 'waiting' }, { memberId: 'm3', status: 'left' }]);
    expect(tonight.get('m2')).toEqual({ kind: 'waiting' });
    expect(tonight.get('m3')).toEqual({ kind: 'left' });
    expect(tonight.has('m4')).toBe(false);
  });

  it('leaves out a player the day list calls playing whose seat the floor has not read yet', () => {
    expect(tonightByMember([], TABLES, [{ memberId: 'm5', status: 'playing' }]).has('m5')).toBe(false);
  });
});

describe('floorSeatHref', () => {
  it('opens the seat on the live floor', () => {
    expect(floorSeatHref('t2', 3)).toBe('/?table=t2&seat=3');
  });
});
