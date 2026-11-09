import { tableToSeatAt } from '@rivr/domain/tables';
import { isSeatAlert, openSeatsAt, type FloorRequest } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, DockedPanel, Inline, Screen, Segmented, useIsWide, useShortcut, type ButtonShortcut } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { floorSearchFrom } from './floorSearch.ts';
import { AlsoWaiting } from './AlsoWaiting.tsx';
import { FloorSheets, useRequestOpeners, type FloorSheet } from './FloorSheets.tsx';
import { FloorTiles, type FloorView } from './FloorTiles.tsx';
import { requestActions, type RequestActionsFor } from './requestActions.ts';
import { RequestList, tableNameOf } from './RequestList.tsx';
import { useFloorData, useNow, type FloorData } from './useFloorData.ts';
import { useFloorFocus } from './useFloorFocus.ts';
import { useRequestChanges } from './useRequestChanges.ts';
import { listedRows, requestKey, useRequestQueue } from './useRequestQueue.ts';
import { useSeatChanges } from './useSeatChanges.ts';
import { useTableChanges } from './useTableChanges.ts';

interface FloorProps {
  venueId: string;
  permissions: readonly string[];
}

/** Where Seat a player opens: the first open table with someone waiting, else one with a free seat (decision 0479). */
function seatAnyOf(data: FloorData): FloorSheet | null {
  const taken = [...data.seats, ...data.held];
  const table = tableToSeatAt(data.tables.map((one) => ({ ...one, openSeats: openSeatsAt(one, taken).length })));
  return table === null ? null : { kind: 'seat', tableId: table.id, seat: openSeatsAt(table, taken)[0] ?? null };
}

/** The requests panel: open at a desk from 1200 px, folded below, until the staff member folds or opens it. */
function usePanel() {
  const isWide = useIsWide('wide');
  const navigate = useNavigate();
  const { panel, ...focus } = floorSearchFrom(useSearch({ strict: false }));
  const isAskedOpen = panel === 'open';
  const [choice, setChoice] = useState<boolean | null>(null);
  const isOpen = isAskedOpen || (choice ?? isWide);
  const toggle = () => {
    setChoice(!isOpen);
    // Folded, the address stops asking for it, so the header's requests can open it again (audit F-078).
    if (isAskedOpen) void navigate({ to: '/', search: focus, replace: true });
  };
  return { isOpen, toggle, open: useCallback(() => setChoice(true), []) };
}

/** The screen's controls: Summary or Seats, Needs you, and the one gold button, Seat a player. */
function FloorControls({ view, onView, isNeedsYouOnly, onNeedsYou, onSeat, seatKey }: {
  view: FloorView; onView: (view: FloorView) => void; isNeedsYouOnly: boolean; onNeedsYou: () => void; onSeat: (() => void) | null;
  seatKey: ButtonShortcut | undefined;
}) {
  return (
    <Inline gap={3} wrap>
      <Segmented label={t('console.floor.view')} value={view} onChange={onView}
        options={[{ value: 'summary', label: t('console.floor.summary') }, { value: 'seats', label: t('console.floor.seats') }]} />
      <Button variant="subtle" size="compact" hasDot isPressed={isNeedsYouOnly} onClick={onNeedsYou}>{t('console.floor.needsYou')}</Button>
      {onSeat === null ? null : <Button variant="primary" size="compact" shortcut={seatKey} onClick={onSeat}>{t('console.floor.seatPlayer')}</Button>}
    </Inline>
  );
}

/** The request whose own button holds the focus, by the key RequestList marks it with; none when the focus is elsewhere. */
function focusedRequestKey(): string | null {
  return document.activeElement?.closest('[data-request]')?.getAttribute('data-request') ?? null;
}

/**
 * The floor's keys, through the console's registry (decision 0478): A and D act on the request whose button holds the
 * focus, else the first shown; S opens Seat a player; each only while there is something to do, and only while the staff
 * member keeps shortcuts on. Seating an approved player is the floor's own press, never a key. Gives back S for Seat a
 * player's tooltip.
 */
function useFloorKeys(requests: readonly FloorRequest[], tables: FloorData['tables'], forActions: Omit<RequestActionsFor, 'tableName'>,
  seat: (() => void) | null): ButtonShortcut | undefined {
  const askable = requests.filter((request) => !isSeatAlert(request));
  const actionsOf = (request: FloorRequest) => requestActions(request, { ...forActions, tableName: tableNameOf(tables, request.tableId) });
  // With the focus on a request, only that one: an approved player's row (seating is never a key) takes no A or D at all.
  const target = () => {
    const focused = focusedRequestKey();
    return focused === null ? askable[0] : askable.find((request) => requestKey(request) === focused);
  };
  const run = (which: 'primary' | 'secondary') => {
    const request = target();
    if (request !== undefined) void actionsOf(request)[which]?.run();
  };
  const oldest = askable[0];
  useShortcut({ key: 'a', label: t('console.floor.keys.approve'), onPress: () => run('primary'), isEnabled: oldest !== undefined });
  useShortcut({ key: 'd', label: t('console.floor.keys.decline'), onPress: () => run('secondary'),
    isEnabled: askable.some((request) => actionsOf(request).secondary !== undefined) });
  return useShortcut({ key: 's', label: t('console.floor.seatPlayer'), onPress: () => seat?.(), isEnabled: seat !== null });
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
  const openers = useRequestOpeners(venueId, data, setSheet);
  const focusTableId = useFloorFocus(data, setSheet);
  const openSeat = seatAny === null ? null : () => setSheet(seatAny);
  const seatKey = useFloorKeys(queue.shown, data.tables, { changes: changes.requests, ...openers }, openSeat);
  const requestsPanel = (
    <>
      <RequestList requests={queue.shown} tables={data.tables} targets={data.targets} now={now} fresh={queue.fresh} changes={changes.requests}
        {...openers} />
      <AlsoWaiting venueId={venueId} permissions={permissions} />
    </>
  );
  return (
    <DockedPanel title={t('console.floor.requests.title')} count={listedRows(data.requests ?? []).length} isOpen={panel.isOpen} onToggle={panel.toggle}
      panel={requestsPanel} onHoverChange={queue.hold} hasPanel={isFloor}>
      <Screen title={t('console.liveFloor.title')} actions={(
        <FloorControls view={view} onView={setView} isNeedsYouOnly={isNeedsYouOnly} onNeedsYou={() => setNeedsYouOnly(!isNeedsYouOnly)}
          onSeat={openSeat} seatKey={seatKey} />
      )}>
        <FloorTiles tables={data.tables} seats={data.seats} held={data.held} view={view} isNeedsYouOnly={isNeedsYouOnly} focusTableId={focusTableId}
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
 * sheet for each player, open seat and table. Every change shows a toast with Undo for five seconds (decision 0480).
 */
export function Floor({ venueId, permissions }: FloorProps) {
  const floor = useFloorData(venueId, permissions);
  const title = t('console.liveFloor.title');
  if (floor.status === 'loading') return <Screen title={title} status="loading" loadingLook="tiles" />;
  if (floor.status === 'error') return <Screen title={title} status="error" onRetry={floor.retry} />;
  if (floor.data.tables.length === 0) return <Screen title={title} status="empty" emptyText={t('console.liveFloor.empty')} />;
  return <FloorReady venueId={venueId} permissions={permissions} data={floor.data} />;
}
