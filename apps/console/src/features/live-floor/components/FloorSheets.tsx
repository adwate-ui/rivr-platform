import type { FloorRequest, SeatedPlayer } from '@rivr/db';
import { useNavigate } from '@tanstack/react-router';
import type { FloorData } from './useFloorData.ts';
import { LeaveSheet, type Leaver } from './LeaveSheet.tsx';
import { PlayerSheet } from './PlayerSheet.tsx';
import type { LeaveRequest } from './requestActions.ts';
import { tableNameOf } from './RequestList.tsx';
import { SeatSheet } from './SeatSheet.tsx';
import { TableSheet } from './TableSheet.tsx';
import type { RequestChanges } from './useRequestChanges.ts';
import type { SeatChanges } from './useSeatChanges.ts';
import type { TableChanges } from './useTableChanges.ts';

/** The sheet open on the floor: a player's, an open seat's, a table's, or leaving. */
export type FloorSheet =
  | { readonly kind: 'player'; readonly sessionId: string }
  | { readonly kind: 'seat'; readonly tableId: string; readonly seat: number | null }
  | { readonly kind: 'table'; readonly tableId: string }
  | { readonly kind: 'leave'; readonly leaver: Leaver };

/** A seated player as one who leaves: their seat, and the call time they still owe. */
export function leaverOf(player: SeatedPlayer, tableName: string): Leaver {
  return {
    memberId: player.memberId, fullName: player.fullName, tableName, seat: { sessionId: player.sessionId, number: player.seat },
    owedSeconds: Math.max(0, player.callTimeLeft ?? 0),
  };
}

/** The leaver a request names: the player leaving (as seated now), or one who left owing call time. */
export function leaverOfRequest(request: LeaveRequest, data: FloorData): Leaver | null {
  const tableName = tableNameOf(data.tables, request.tableId);
  if (request.kind === 'left_owing') {
    return { memberId: request.memberId, fullName: request.fullName, tableName, seat: null, owedSeconds: request.owedSeconds };
  }
  const player = data.seats.find((seat) => seat.sessionId === request.sessionId);
  return player === undefined ? null : leaverOf(player, tableName);
}

/** What a request's Leave and its name open: the leave sheet, the player's sheet, or the record of one not seated. */
export function useRequestOpeners(data: FloorData, onSheet: (sheet: FloorSheet) => void) {
  const navigate = useNavigate();
  return {
    onLeave: (request: LeaveRequest) => {
      const leaver = leaverOfRequest(request, data);
      if (leaver !== null) onSheet({ kind: 'leave', leaver });
    },
    onOpen: (request: FloorRequest) => {
      if (request.kind === 'join' || request.kind === 'left_owing') void navigate({ href: `/members?member=${request.memberId}` });
      else onSheet({ kind: 'player', sessionId: request.sessionId });
    },
  };
}

export interface FloorSheetsProps {
  venueId: string;
  sheet: FloorSheet | null;
  data: FloorData;
  now: Date;
  permissions: readonly string[];
  changes: { readonly requests: RequestChanges; readonly seats: SeatChanges; readonly tables: TableChanges };
  onSheet: (sheet: FloorSheet | null) => void;
}

/** The player's sheet, while they are still seated; Leave opens the leave sheet in its place. */
function PlayerSheetFor({ venueId, sessionId, data, now, permissions, changes, onSheet }: Omit<FloorSheetsProps, 'sheet'> & { sessionId: string }) {
  const player = data.seats.find((seat) => seat.sessionId === sessionId);
  const table = data.tables.find((one) => one.id === player?.tableId);
  if (player === undefined || table === undefined) return null;
  const requests: readonly FloorRequest[] = data.requests ?? [];
  return (
    <PlayerSheet venueId={venueId} player={player} table={table} tables={data.tables} seats={data.seats} held={data.held} requests={requests}
      targets={data.targets} now={now} permissions={permissions} changes={changes} onClose={() => onSheet(null)}
      onLeave={() => onSheet({ kind: 'leave', leaver: leaverOf(player, table.name) })} />
  );
}

/** Whichever sheet is open on the floor, built from what the floor read last; none once its subject is gone. */
export function FloorSheets(props: FloorSheetsProps) {
  const { venueId, sheet, data, now, permissions, changes, onSheet } = props;
  const close = () => onSheet(null);
  switch (sheet?.kind) {
    case 'player': return <PlayerSheetFor {...props} sessionId={sheet.sessionId} />;
    case 'seat': return <SeatSheet venueId={venueId} tables={data.tables} seats={data.seats} held={data.held} start={sheet} now={now} changes={changes.seats} onClose={close} />;
    case 'leave': return <LeaveSheet leaver={sheet.leaver} canLetGo={permissions.includes('call_time.override')} changes={changes.seats} onClose={close} />;
    case 'table': {
      const table = data.tables.find((one) => one.id === sheet.tableId);
      return table === undefined ? null : (
        <TableSheet table={table} tables={data.tables} seats={data.seats} night={data.night} canManage={permissions.includes('floor.manage')}
          changes={changes.tables} onClose={close} />
      );
    }
    default: return null;
  }
}
