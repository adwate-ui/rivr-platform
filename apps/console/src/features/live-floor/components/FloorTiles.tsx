import type { FloorTable, HeldSeat, SeatedPlayer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Grid, SeatRow, Stack, TableTile, Text } from '@rivr/ui';
import { useState } from 'react';
import { callTimeMeta, needsFloor, requestFlag, roomName, seatsAt, stakeOf, tileSeats } from './seatState.ts';

/** Summary shows each tile's bar; Seats lists every seat under it. */
export type FloorView = 'summary' | 'seats';

export interface FloorTilesProps {
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  view: FloorView;
  /** Only the tables where a player needs the floor. */
  isNeedsYouOnly: boolean;
  /** The table a link pointed at: brought into view with its seats shown. */
  focusTableId?: string | undefined;
  /** Floor managers (floor.manage) open a closed table from its tile. */
  canOpenTables: boolean;
  onPlayer: (player: SeatedPlayer) => void;
  onOpenSeat: (table: FloorTable, seat: number) => void;
  onTable: (table: FloorTable) => void;
  onOpenTable: (table: FloorTable) => void;
}

type TileProps = Omit<FloorTilesProps, 'tables' | 'view' | 'isNeedsYouOnly' | 'focusTableId'> & {
  isScrolledTo: boolean;
  table: FloorTable;
  isExpanded: boolean;
  onToggle: () => void;
};

/** One table's tile: its bar, or Closed with Open table; expanded, a row per seat. */
function Tile({ table, seats, held, canOpenTables, isExpanded, isScrolledTo, onToggle, onPlayer, onOpenSeat, onTable, onOpenTable }: TileProps) {
  const openAction = canOpenTables
    ? <Button variant="subtle" size="small" onClick={() => onOpenTable(table)}>{t('console.liveFloor.openTable')}</Button>
    : undefined;
  return (
    <TableTile name={table.name} stake={stakeOf(table)} seats={tileSeats(table, seats, held)} isClosed={!table.isOpen} openAction={openAction}
      isExpanded={isExpanded} isScrolledTo={isScrolledTo} onToggle={onToggle} onSettings={() => onTable(table)}>
      {seatsAt(table, seats).map((player, index) => (player === undefined ? (
        <SeatRow key={index} number={index + 1} onSelect={() => onOpenSeat(table, index + 1)} />
      ) : (
        <SeatRow key={index} number={index + 1} name={player.fullName} meta={callTimeMeta(player)} request={requestFlag(player)}
          onSelect={() => onPlayer(player)} />
      )))}
    </TableTile>
  );
}

/** Whether a table has a player who needs the floor. */
const needsYou = (table: FloorTable, seats: readonly SeatedPlayer[]) => seats.some((player) => player.tableId === table.id && needsFloor(player));

/**
 * The floor's tiles (console v3), room by room: each active table's name, stake and seat bar, or Closed with Open table.
 * In Summary a tile opens its seats when pressed; in Seats every tile shows them until pressed. Needs you keeps only the
 * tables where someone asks for the floor.
 */
export function FloorTiles(props: FloorTilesProps) {
  const { tables, seats, view, isNeedsYouOnly } = props;
  // A table pressed open in Summary, or shut in Seats.
  const [pressed, setPressed] = useState<Readonly<Record<string, boolean>>>({});
  const shown = isNeedsYouOnly ? tables.filter((table) => needsYou(table, seats)) : tables;
  const rooms = (['main', 'private'] as const).map((room) => ({ room, tables: shown.filter((table) => table.room === room) }))
    .filter((room) => room.tables.length > 0);
  if (rooms.length === 0 && isNeedsYouOnly) return <Text tone="muted">{t('console.floor.noneNeedsYou')}</Text>;
  return (
    <Stack gap={8}>
      {rooms.map(({ room, tables: here }) => (
        <Stack key={room} gap={3} as="section" aria-label={roomName(room)}>
          <Text variant="eyebrow" tone="muted">{roomName(room)}</Text>
          <Grid columns={3} stackBelow="medium" gap={3}>
            {here.map((table) => {
              const isFocused = table.id === props.focusTableId;
              const isExpanded = isFocused || (view === 'seats') !== (pressed[table.id] === true);
              return (
                <Tile key={table.id} {...props} table={table} isExpanded={isExpanded} isScrolledTo={isFocused}
                  onToggle={() => setPressed((current) => ({ ...current, [table.id]: current[table.id] !== true }))} />
              );
            })}
          </Grid>
        </Stack>
      ))}
    </Stack>
  );
}
