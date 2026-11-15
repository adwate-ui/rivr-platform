import { LIST_PAGE, useListChoices, type ListChoices, type ScopedView } from '@rivr/db';
import { useFnbOrdersPage, useMemberCancelledKots, useServeFnbOrder, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { clubDay } from '@rivr/domain/clubDay';
import { isTicketLate } from '@rivr/domain/floorRequests';
import { formatDuration, t } from '@rivr/i18n';
import { ChoiceChips, DataTable, ErrorMessage, Inline, Input, Stack, Text, type DataTableColumn, type DataTableRequest } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { KotNotAtBar } from './KotNotAtBar.tsx';
import { OrderSteps, type Act } from './OrderSteps.tsx';
import { laneOf, orderLines, orderNotes, type OrderLane } from './orderLanes.ts';
import { VoidForm } from './VoidOrder.tsx';

/** Which orders of the day show: those still open, which the list opens on; delivered; void; or all of them. */
const STATES = ['open', 'delivered', 'void', 'all'] as const;
type OrderState = (typeof STATES)[number];

/** How many orders a chip holds, from the server's count of each state over the day. */
function countOf(state: OrderState, counted: ListChoices | undefined): number {
  const of = (value: string) => counted?.['state']?.find((one) => one.value === value)?.count ?? 0;
  if (state === 'open') return of('to_accept') + of('preparing');
  return state === 'all' ? of('to_accept') + of('preparing') + of('delivered') + of('void') : of(state);
}

/** Where an order stands, in words; a void one says so. */
const stateWords = (lane: OrderLane | null) => t(`console.fnb.orders.stateNames.${lane ?? 'void'}`);

/** How long a delivered order took; a standing one's age, that it is on its way, and if it is late (audit F-075, F-096). */
function Age({ order }: { order: FnbOrderTonight }) {
  const lane = laneOf(order);
  const time = formatDuration(order.ageSeconds);
  if (lane === null || lane === 'delivered') return <Text as="span" variant="row" tone="muted">{time}</Text>;
  const age = order.onWayAt === null ? time : t('console.fnb.onWayAge', { time });
  return isTicketLate(order.ageSeconds)
    ? <Text as="span" variant="row" tone="danger">{t('console.fnb.late', { age })}</Text>
    : <Text as="span" variant="row" tone="muted">{age}</Text>;
}

/** What was ordered and what the bar should know with it: the member's note, a guest going or gone (audit F-085), a comp, a KOT the bar printer missed. */
function Ordered({ venueId, order }: { venueId: string; order: FnbOrderTonight }) {
  const note = orderNotes(order);
  const isStanding = laneOf(order) === 'toAccept' || laneOf(order) === 'preparing';
  return (
    <Stack gap={1}>
      <Text variant="small">{orderLines(order)}</Text>
      {note === null ? null : <Text variant="small">{t('console.fnb.note', { note })}</Text>}
      {isStanding && order.seatState !== 'seated' ? <Text variant="small" weight="semibold">{t(order.seatState === 'left' ? 'console.fnb.seatLeft' : 'console.fnb.seatLeaving')}</Text> : null}
      {order.isComp ? <Text variant="caption" weight="semibold">{t('console.fnb.comp')}</Text> : null}
      {order.cancelReason === null ? null : <Text variant="small" tone="muted">{order.cancelReason}</Text>}
      {order.isKotPrintFailed ? <KotNotAtBar venueId={venueId} order={order} /> : null}
    </Stack>
  );
}

/** The table's columns: the KOT, its age, where it goes, what was ordered, where it stands, and the row's next step. */
function columnsFor(venueId: string, counted: ListChoices | undefined, steps: (order: FnbOrderTonight) => ReactNode): readonly DataTableColumn<FnbOrderTonight>[] {
  return [
    { key: 'kot', header: t('console.fnb.orders.columns.kot'), priority: 'primary', sortValue: (order) => order.kotNumber, filter: 'number',
      cell: (order) => t('console.fnb.kot', { kot: order.kotNumber }), exportValue: (order) => order.kotNumber },
    { key: 'age', header: t('console.fnb.orders.columns.age'), sortValue: (order) => order.ageSeconds, filter: 'duration', cell: (order) => <Age order={order} />,
      exportValue: (order) => formatDuration(order.ageSeconds) },
    { key: 'table', header: t('console.fnb.orders.columns.table'), sortValue: (order) => order.tableName, filter: 'choice', choices: counted?.['table'] ?? [],
      filterValue: (order) => order.tableName, cell: (order) => t('console.fnb.orders.seat', { table: order.tableName, seat: order.seat }) },
    { key: 'member', header: t('console.fnb.orders.columns.member'), sortValue: (order) => order.memberName, filter: 'text', cell: (order) => order.memberName },
    { key: 'order', header: t('console.fnb.orders.columns.order'), isWide: true, filter: false, cell: (order) => <Ordered venueId={venueId} order={order} />, exportValue: orderLines },
    { key: 'state', header: t('console.fnb.orders.columns.state'), filter: false, cell: (order) => stateWords(laneOf(order)) },
    // Two shares, so an order being prepared keeps its three buttons on one line.
    { key: 'steps', header: '', align: 'end', isWide: true, filter: false, cell: steps },
  ];
}

/**
 * A club day's orders as one table, a page at a time from the server (redesign RD-30; the owner, 15 Nov: several hundred
 * orders a day over many days). It opens on today's open orders, oldest first; delivered, void and older orders are
 * behind the chips and the day. Service, the floor and the managers accept, send and deliver from the row (#640,
 * decision 0302), and void with a reason under it.
 */
export function OrdersTable({ venueId }: { venueId: string }) {
  const [day, setDay] = useState(() => clubDay(new Date()));
  const [state, setState] = useState<OrderState>('open');
  const [request, setRequest] = useState<DataTableRequest | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const view: ScopedView | null = request === null ? null : { ...request, scope: { day, state } };
  const page = useFnbOrdersPage(venueId, view);
  const counted = useListChoices('fnb_orders', venueId, request === null ? null : { ...request, scope: { day, state: 'all' } }).data;
  const cancelled = useMemberCancelledKots(venueId).data ?? [];
  const serve = useServeFnbOrder(venueId);
  const act: Act = async (done) => {
    const outcome = await done;
    setFailure(outcome.ok ? null : outcome.error);
  };
  const steps = (order: FnbOrderTonight) => <OrderSteps order={order} serve={serve} act={act} onVoid={() => setVoiding(order.orderId)} />;
  const rows = page.data === undefined
    ? (page.isError ? { status: 'error' as const, onRetry: () => void page.refetch() } : { status: 'loading' as const })
    : { rows: page.data.rows, emptyText: t('console.fnb.orders.none') };
  const search = { label: t('console.fnb.orders.search'), variant: 'subtle' as const, text: (order: FnbOrderTonight) => order.memberName };
  const chips = (
    <Inline gap={4} align="end" wrap>
      <ChoiceChips look="subtle" mode="one" isOneRow isLabelVisuallyHidden label={t('console.fnb.orders.columns.state')} selected={[state]}
        options={STATES.map((id) => ({ value: id, label: t(`console.fnb.orders.states.${id}`), count: countOf(id, counted) }))}
        onChange={([picked]) => setState(STATES.find((id) => id === picked) ?? 'open')} />
      <Input type="date" label={t('console.fnb.orders.day')} value={day} onChange={(event) => { if (event.target.value !== '') setDay(event.target.value); }} />
    </Inline>
  );
  return (
    <Stack gap={4}>
      {cancelled.length === 0 ? null : (
        <Text variant="small" tone="muted">{t('console.fnb.memberCancelled', { kots: cancelled.map((kot) => t('console.fnb.kot', { kot })).join(', ') })}</Text>
      )}
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
      <DataTable {...rows} label={t('console.fnb.orders.label')} columns={columnsFor(venueId, counted, steps)} rowKey={(order) => order.orderId} filter={search} belowSearch={chips}
        rowDetail={(order) => (order.orderId === voiding ? <VoidForm venueId={venueId} order={order} onClose={() => setVoiding(null)} /> : null)}
        server={{ total: page.data?.total ?? 0, pageSize: LIST_PAGE, onRequest: setRequest, scope: `${day} ${state}` }} exportRows={page.readEvery} />
    </Stack>
  );
}
