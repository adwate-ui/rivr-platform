import type { FloorTable, WaitlistBoardEntry } from '@rivr/db';

/**
 * The waitlist tests' rows, built once here: a place on Table 1's list and an open table at 100/200. `@rivr/testing` builds
 * seed rows, not `@rivr/db`'s read shapes, and the console does not depend on it.
 */
export function buildPlace(overrides: Partial<WaitlistBoardEntry> & Pick<WaitlistBoardEntry, 'place' | 'fullName'>): WaitlistBoardEntry {
  return {
    entryId: `e${String(overrides.place)}`, tableTypeId: 'tt', memberId: `m${String(overrides.place)}`, joinedAt: '2026-11-15T15:35:00Z',
    addedByFloor: false, priorityReason: null, callTableName: null, callSeat: null, holdUntil: null, awayUntil: null, tableId: 't1',
    onWayAt: null, needsIdCheck: false, ...overrides,
  };
}

/** An open table at 100/200 with three seats free, its call time three hours. */
export function buildFloorTable(overrides: Partial<FloorTable> = {}): FloorTable {
  return {
    id: 't1', venueId: 'v1', name: 'Table 1', room: 'main', seats: 9, tableTypeId: 'tt', tableTypeName: 'NLH 100/200', game: 'nlh',
    smallBlind: 10000n, bigBlind: 20000n, buyIn: 1000000n, straddle: null, waiting: 0, callTimeMinutes: 180, openSeats: 3,
    mustMoveToTableId: null, isOpen: true, ...overrides,
  };
}
