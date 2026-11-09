import { describe, expect, it } from 'vitest';
import { placeMeta, tableMeta, isLatePlace } from './placeMeta.ts';
import { buildFloorTable, buildPlace } from './waitlistFixtures.ts';

const NOW = new Date('2026-11-15T15:40:00Z');

const ENTRY = buildPlace({ place: 1, fullName: 'Ishaan Verma' });

const TABLE = buildFloorTable();

describe("a place's line under its name (console v3)", () => {
  it('says how long they have waited, then that the floor added them', () => {
    expect(placeMeta(ENTRY, NOW)).toBe('5 min');
    expect(placeMeta({ ...ENTRY, addedByFloor: true }, NOW)).toBe('5 min · added by the floor');
  });

  it('says why a place is ahead of join time, its call and that it is held', () => {
    expect(placeMeta({ ...ENTRY, priorityReason: 'Black card' }, NOW)).toBe('5 min · Black card');
    expect(placeMeta({ ...ENTRY, callSeat: 4, holdUntil: '2026-11-15T15:52:00Z', onWayAt: '2026-11-15T15:41:00Z' }, NOW))
      .toBe('5 min · called to seat 4 until 21:22 · on the way');
    expect(placeMeta({ ...ENTRY, joinedAt: '2026-11-15T15:11:00Z', awayUntil: '2026-11-15T16:00:00Z' }, NOW)).toBe('29 min · place held');
  });
});

describe("a table's line on its card", () => {
  it('names the stake once and how many seats are free, or that it is closed', () => {
    expect(tableMeta(TABLE)).toBe('NLH 100/200 · 3 open');
    expect(tableMeta({ ...TABLE, tableTypeName: 'Private Room', straddle: 50000n })).toBe('NLH 100/200/500 · 3 open');
    expect(tableMeta({ ...TABLE, isOpen: false })).toBe('NLH 100/200 · closed');
  });

  it('says a place is late past forty-five minutes, but not one called or held, whose hold runs its own clock (audit F-075)', () => {
    const late = { ...ENTRY, joinedAt: new Date(NOW.getTime() - 46 * 60_000).toISOString() };
    expect(placeMeta(late, NOW)).toMatch(/^Late · 46 min/);
    expect(isLatePlace(late, NOW)).toBe(true);
    expect(isLatePlace({ ...late, holdUntil: '2026-11-15T15:52:00Z', callSeat: 4 }, NOW)).toBe(false);
    expect(isLatePlace({ ...late, awayUntil: '2026-11-15T16:00:00Z' }, NOW)).toBe(false);
    expect(isLatePlace(late, NOW, false)).toBe(false);
  });

  it('says where else the stake has room, last (audit F-036)', () => {
    const roomAt = buildFloorTable({ name: 'Table 4', openSeats: 6 });
    expect(placeMeta({ ...ENTRY, addedByFloor: true }, NOW, { isTableOpen: true, roomAt })).toBe('5 min · added by the floor · Table 4 has 6 open');
    expect(placeMeta({ ...ENTRY, callSeat: 4, holdUntil: '2026-11-15T15:52:00Z' }, NOW, { isTableOpen: true, roomAt })).not.toContain('Table 4');
  });
});
