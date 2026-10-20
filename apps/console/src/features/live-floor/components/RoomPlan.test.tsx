import type { FloorNight, FloorTable, SeatedPlayer } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomPlan } from './RoomPlan.tsx';

const TABLE: Omit<FloorTable, 'id' | 'name' | 'room' | 'isOpen'> = {
  venueId: 'v1', seats: 9, tableTypeId: 'tt', tableTypeName: 'NLH 100/200', smallBlind: 10000n, bigBlind: 20000n, buyIn: 1000000n,
  straddle: null, waiting: 0, openSeats: null, mustMoveToTableId: null,
};
const TABLES: FloorTable[] = [
  { ...TABLE, id: 't3', name: 'Table 3', room: 'main', isOpen: true },
  { ...TABLE, id: 't4', name: 'Table 4', room: 'main', isOpen: false },
  { ...TABLE, id: 'pr', name: 'Private Room', room: 'private', isOpen: true },
];
const SEATED: SeatedPlayer = {
  sessionId: 's1', tableId: 't3', seat: 1, memberId: 'm1', fullName: 'Vikram Rao', tierName: 'Gold', startedAt: '2026-11-15T15:00:00Z',
  mustMoveOrder: null, isAway: false, callTimeLeft: null,
};
const NIGHT: FloorNight = {
  rake: fromPaise(41_175_000n),
  tables: [
    { tableId: 't3', hands: 287, handsLastHour: 30, dealerName: 'Pema Lepcha', rake: fromPaise(9_630_000n), rakeBasisPoints: 500, rakeCap: fromPaise(600_000n) },
    { tableId: 't4', hands: 0, handsLastHour: 0, dealerName: null, rake: fromPaise(0n), rakeBasisPoints: 500, rakeCap: fromPaise(600_000n) },
  ],
};

afterEach(cleanup);

describe('the room plan', () => {
  it('shows rake tonight, the seated count, each room, and each table\'s figures; a card opens its table', () => {
    const onChoose = vi.fn();
    render(<RoomPlan tables={TABLES} seats={[SEATED]} held={[]} night={NIGHT} chosenId="t3" onChoose={onChoose} />);
    expect(screen.getByText('₹4,11,750')).toBeDefined();
    expect(screen.getByText('1 seated')).toBeDefined();
    expect(screen.getByText('Main room')).toBeDefined();
    const table3 = screen.getByRole('button', { name: 'Table 3' });
    expect(table3.getAttribute('aria-pressed')).toBe('true');
    expect(within(table3).getByText('1 of 9')).toBeDefined();
    expect(within(table3).getByText('₹96,300')).toBeDefined();
    expect(within(table3).getByText('Pema Lepcha')).toBeDefined();
    expect(within(table3).getByText('30 hands/hr')).toBeDefined();
    const table4 = screen.getByRole('button', { name: 'Table 4' });
    expect(within(table4).getByText('Closed')).toBeDefined();
    expect(within(table4).getByText('No dealer')).toBeDefined();
    fireEvent.click(table4);
    expect(onChoose).toHaveBeenCalledWith('t4');
  });

  it('shows no rake to staff who do not read the ledger', () => {
    render(<RoomPlan tables={TABLES} seats={[]} held={[]} night={{ rake: null, tables: NIGHT.tables.map((table) => ({ ...table, rake: null })) }}
      chosenId="t3" onChoose={() => undefined} />);
    expect(screen.queryByText('Rake tonight')).toBeNull();
    expect(screen.queryByText(/₹/)).toBeNull();
  });
});
