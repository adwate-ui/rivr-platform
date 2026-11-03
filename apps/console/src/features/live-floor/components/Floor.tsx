import { tableToSeatAt } from '@rivr/domain/tables';
import { openSeatsAt, type FloorRequest } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, DockedPanel, Inline, Screen, Segmented, useIsWide } from '@rivr/ui';
import { useCallback, useState } from 'react';
import { AlsoWaiting } from './AlsoWaiting.tsx';
import { FloorSheets, useRequestOpeners, type FloorSheet } from './FloorSheets.tsx';
import { FloorTiles, type FloorView } from './FloorTiles.tsx';
import { requestActions, type RequestActionsFor } from './requestActions.ts';
import { RequestList, tableNameOf } from './RequestList.tsx';
import { useFloorData, useNow, type FloorData } from './useFloorData.ts';
import { useFloorShortcuts } from './useFloorShortcuts.ts';
import { useRequestChanges } from './useRequestChanges.ts';
import { useRequestQueue } from './useRequestQueue.ts';
import { useSeatChanges } from './useSeatChanges.ts';
import { useTableChanges } from './useTableChanges.ts';

interface FloorProps {
  venueId: string;
  permissions: readonly string[];
}

/** Where Seat a player opens: the first open table with someone waiting, else one with a free seat (decision 0446). */
function seatAnyOf(data: FloorData): FloorSheet | null {
  const taken = [...data.seats, ...data.held];
  const table = tableToSeatAt(data.tables.map((one) => ({ ...one, openSeats: openSeatsAt(one, taken).length })));
  return table === null ? null : { kind: 'seat', tableId: table.id, seat: openSeatsAt(table, taken)[0] ?? null };
}

/** The requests panel: open at a desk from 1200 px, folded below, until the staff member folds or opens it. */
function usePanel() {
  const isWide = useIsWide('wide');
  const [choice, setChoice] = useState<boolean | null>(null);
  const isOpen = choice ?? isWide;
  return { isOpen, toggle: () => setChoice(!isOpen), open: useCallback(() => setChoice(true), []) };
}

/** The screen's controls: Summary or Seats, Needs you, and the one gold button, Seat a player. */
function FloorControls({ view, onView, isNeedsYouOnly, onNeedsYou, onSeat }: {
  view: FloorView; onView: (view: FloorView) => void; isNeedsYouOnly: boolean; onNeedsYou: () => void; onSeat: (() => void) | null;
}) {
  return (
    <Inline gap={3} wrap>
      <Segmented label={t('console.floor.view')} value={view} onChange={onView}
        options={[{ value: 'summary', label: t('console.floor.summary') }, { value: 'seats', label: t('console.floor.seats') }]} />
      <Button variant="subtle" size="compact" isPressed={isNeedsYouOnly} onClick={onNeedsYou}>{t('console.floor.needsYou')}</Button>
      {onSeat === null ? null : <Button variant="primary" size="compact" onClick={onSeat}>{t('console.floor.seatPlayer')}</Button>}
    </Inline>
  );
}

/** The keys A and D act on the oldest request shown, S opens Seat a player (console v3). */
function useOldestKeys(oldest: FloorRequest | undefined, forActions: RequestActionsFor, seat: () => void) {
  const actions = oldest === undefined ? undefined : requestActions(oldest, forActions);
  useFloorShortcuts({ approve: () => void actions?.primary.run(), decline: () => void actions?.secondary?.run(), seat });
}

/** The floor once read: tiles, the requests panel, the sheets, and the keys A, D and S. */
function FloorReady({ venueId, permissions, data }: FloorProps & { data: FloorData }) {
  const now = useNow();
  const [view, setView] = useState<FloorView>('summary');
  const [isNeedsYouOnly, setNeedsYouOnly] = useState(false);
  const [sheet, setSheet] = useState<FloorSheet | null>(null);
  const panel = usePanel();
  const queue = useRequestQueue(data.requests, panel.open);
  const changes = { requests: useRequestChanges(venueId), seats: useSeatChanges(venueId), tables: useTableChanges(venueId) };
  const isFloor = permissions.includes('waitlist.manage');
  const seatAny = isFloor ? seatAnyOf(data) : null;
  const { onLeave, onOpen } = useRequestOpeners(data, setSheet);
  const oldest = queue.shown[0];
  useOldestKeys(oldest, { changes: changes.requests, tableName: tableNameOf(data.tables, oldest?.tableId ?? ''), onLeave }, () => { if (seatAny !== null) setSheet(seatAny); });
  const requestsPanel = (
    <>
      <RequestList requests={queue.shown} tables={data.tables} targets={data.targets} now={now} fresh={queue.fresh} changes={changes.requests}
        onLeave={onLeave} onOpen={onOpen} />
      <AlsoWaiting venueId={venueId} permissions={permissions} />
    </>
  );
  return (
    <DockedPanel title={t('console.floor.requests.title')} count={data.requests?.length ?? 0} isOpen={panel.isOpen} onToggle={panel.toggle}
      panel={requestsPanel} onHoverChange={queue.hold} hasPanel={isFloor}>
      <Screen title={t('console.liveFloor.title')} actions={(
        <FloorControls view={view} onView={setView} isNeedsYouOnly={isNeedsYouOnly} onNeedsYou={() => setNeedsYouOnly(!isNeedsYouOnly)}
          onSeat={seatAny === null ? null : () => setSheet(seatAny)} />
      )}>
        <FloorTiles tables={data.tables} seats={data.seats} held={data.held} view={view} isNeedsYouOnly={isNeedsYouOnly}
          canOpenTables={permissions.includes('floor.manage')} onPlayer={(player) => setSheet({ kind: 'player', sessionId: player.sessionId })}
          onOpenSeat={(table, seat) => { if (isFloor && table.isOpen) setSheet({ kind: 'seat', tableId: table.id, seat }); }}
          onTable={(table) => setSheet({ kind: 'table', tableId: table.id })} onOpenTable={(table) => void changes.tables.setOpen(table, true)} />
      </Screen>
      <FloorSheets venueId={venueId} sheet={sheet} data={data} now={now} permissions={permissions} changes={changes} onSheet={setSheet} />
    </DockedPanel>
  );
}

/**
 * The Live floor (console v3, phase 2): the venue's active tables room by room, the requests docked beside them, and a
 * sheet for each player, open seat and table. Every change shows a toast with Undo for five seconds (decision 0447).
 */
export function Floor({ venueId, permissions }: FloorProps) {
  const floor = useFloorData(venueId, permissions);
  const title = t('console.liveFloor.title');
  if (floor.status === 'loading') return <Screen title={title} status="loading" loadingLook="tiles" />;
  if (floor.status === 'error') return <Screen title={title} status="error" onRetry={floor.retry} />;
  if (floor.data.tables.length === 0) return <Screen title={title} status="empty" emptyText={t('console.liveFloor.empty')} />;
  return <FloorReady venueId={venueId} permissions={permissions} data={floor.data} />;
}
