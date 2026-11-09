import { err, FNB_DIETS, ok, type FnbDiet, type FnbItemKind, type FnbLine, type Result } from '@rivr/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { itemPhotoUrl } from './itemPhotos.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

export { useCancelMyFnbOrder, type CancelMyOrderFailure } from './fnbCancel.ts';
export { useSaveFnbMenu, type FnbMenuFailure, type FnbMenuFileItem } from './fnbMenuFile.ts';

/** An item on the table-side menu (#123): Glaza's, no price. */
export interface FnbMenuItem {
  readonly itemId: string;
  readonly name: string;
  readonly kind: FnbItemKind;
  /** The club's own photo of the dish or drink, or null until one is added (AS-11). */
  readonly photoUrl: string | null;
  /** Veg, egg or non-veg, for the mark beside its name (F-052); null where nobody has said. */
  readonly diet: FnbDiet | null;
  /** A line on what it is, up to 140 characters; null with none. */
  readonly description: string | null;
}

/** An item as staff who run F&B keep it: whether it is on offer, and where it sits on the menu. */
export interface FnbItem extends FnbMenuItem {
  readonly isAvailable: boolean;
  readonly position: number;
}

/** An order placed: the KOT the bar prints, numbered for the night. */
export interface PlacedFnbOrder {
  readonly orderId: string;
  readonly kotNumber: number;
}

/** One of tonight's orders as the console lists it. */
export interface FnbOrderTonight {
  readonly orderId: string;
  readonly kotNumber: number;
  readonly tableName: string;
  readonly seat: number;
  readonly memberName: string;
  readonly memberNumber: number;
  readonly lines: readonly { itemId: string; name: string; quantity: number; note: string | null }[];
  readonly isComp: boolean;
  readonly source: 'app' | 'tablet' | 'console';
  readonly createdAt: string;
  /** Null while the bar has not been given the KOT: the agent prints it, or staff hand it over and mark it. */
  readonly kotSentBy: 'agent' | 'staff' | null;
  /**
   * The bar printer did not get the KOT (console v3): the agent's last attempt failed, or it closed it unprinted. From the
   * outbox's bar_printer delivery, never a clock; false once the bar has it or the order is void.
   */
  readonly isKotPrintFailed: boolean;
  /** Whether the guest it goes to is still in that seat (audit F-085): `leaving` once they have asked to go, `left` once it has ended. */
  readonly seatState: 'seated' | 'leaving' | 'left';
  /** When service accepted it and delivered it (#640); null until then. */
  readonly acceptedAt: string | null;
  readonly deliveredAt: string | null;
  /** When a runner left the bar with it (decision 0320); null before. */
  readonly onWayAt: string | null;
  /** Whole seconds since it was placed, or, once delivered or void, the seconds until then. */
  readonly ageSeconds: number;
  /** When staff voided it, and why, which the member sees (decision 0302); null for an order that stands. */
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
}

/**
 * Why an order did not go through: not allowed (the tier, the role, or not a tablet), nobody seated there, an item no
 * longer on the menu, a second app order inside the minute, alcohol under 21, no dealer on the tablet, the member's account
 * paused, the venue frozen, a malformed order, or anything else.
 */
export type FnbFailure =
  | 'not_allowed' | 'not_seated' | 'not_on_menu' | 'too_soon' | 'too_young' | 'no_dealer' | 'account_paused' | 'paused' | 'invalid' | 'unavailable'
  // Serving (#640): someone else accepted or delivered the order first.
  | 'taken';

const FAILURE_BY_CODE: Readonly<Record<string, FnbFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVFNS: 'not_seated', RVFNI: 'not_on_menu', RVFST: 'too_soon', RVAGE: 'too_young',
  RVDWN: 'no_dealer', RVFRZ: 'paused', RVMBR: 'account_paused',
};

/** A request id already used for another order is no fault in the order's quantities, so it says Not sent (F-152). */
function failureOf(error: { code: string; message: string }): FnbFailure {
  if (error.code === '22023' && error.message.startsWith('That request id')) return 'unavailable';
  return FAILURE_BY_CODE[error.code] ?? 'unavailable';
}

// The console's KOTs to print and tonight's orders ask again every ten seconds: orders arrive from the tables.
const ORDERS_CHECK = 10_000;

interface PlacedRow { order_id: string; kot_number: number }

function placed(data: readonly PlacedRow[] | null, error: { code: string; message: string } | null): Result<PlacedFnbOrder, FnbFailure> {
  if (error) return err(failureOf(error));
  const row = data?.[0];
  return row ? ok({ orderId: row.order_id, kotNumber: row.kot_number }) : err('unavailable');
}

/** Order lines as the database takes them. */
function linesJson(lines: readonly FnbLine[]) {
  return lines.map((line) => ({ item_id: line.item_id, quantity: line.quantity, note: line.note ?? null }));
}

const dietOf = (text: string | null): FnbDiet | null => FNB_DIETS.find((diet) => diet === text) ?? null;

function menuItem(client: RivrClient, row: { item_id: string; name: string; kind: FnbItemKind; photo_path: string | null; diet: string | null; description: string | null }): FnbMenuItem {
  return { itemId: row.item_id, name: row.name, kind: row.kind, photoUrl: itemPhotoUrl(client, row.photo_path), diet: dietOf(row.diet), description: row.description };
}

/** The signed-in member's menu at their venue: alcohol only at 21 or over, nothing without table-side ordering. */
export function useMyFnbMenu() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myFnbMenu(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<FnbMenuItem[]> => {
      const { data, error } = await client.rpc('my_fnb_menu');
      if (error) throw error;
      return data.map((row) => menuItem(client, row));
    },
  });
}

/** A venue's menu for its staff or its dealer tablet. */
export function useFnbMenu(venueId: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.fnbMenu(userId ?? 'signed-out', venueId ?? 'no-venue'),
    enabled: userId !== null && venueId !== null,
    queryFn: async (): Promise<FnbMenuItem[]> => {
      const { data, error } = await client.rpc('fnb_menu', { p_venue_id: venueId ?? '' });
      if (error) throw error;
      return data.map((row) => menuItem(client, row));
    },
  });
}

/** Where one of the member's orders is (#635): placed, accepted and being prepared, delivered to the seat, or void (decision 0302). */
export type FnbOrderProgress = 'placed' | 'in_progress' | 'delivered' | 'cancelled';

const progressOf = (row: { cancelled_at: string | null; delivered_at: string | null; accepted_at: string | null }): FnbOrderProgress => {
  if (row.cancelled_at !== null) return 'cancelled';
  if (row.delivered_at !== null) return 'delivered';
  return row.accepted_at !== null ? 'in_progress' : 'placed';
};

/** One of the member's orders tonight: its KOT, what, when, and where it is. */
export interface MyFnbOrder {
  readonly orderId: string;
  readonly kotNumber: number;
  readonly lines: FnbOrderTonight['lines'];
  readonly createdAt: string;
  readonly progress: FnbOrderProgress;
  /** Why staff voided it; null unless void. */
  readonly cancelReason: string | null;
  /** When the bar took each step (decision 0320): the tracker reads its stage from them. */
  readonly acceptedAt: string | null;
  readonly onWayAt: string | null;
  readonly deliveredAt: string | null;
}

/** The signed-in member's orders tonight, newest first, asked again every ten seconds as the bar works through them (#635). */
export function useMyFnbOrders() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myFnbOrders(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: ORDERS_CHECK,
    queryFn: async (): Promise<MyFnbOrder[]> => {
      const { data, error } = await client.rpc('my_fnb_orders');
      if (error) throw error;
      return data.map((row) => ({
        orderId: row.order_id, kotNumber: row.kot_number, lines: linesOf(row.lines), createdAt: row.created_at,
        progress: progressOf(row), cancelReason: row.cancel_reason,
        acceptedAt: row.accepted_at, onWayAt: row.on_way_at, deliveredAt: row.delivered_at,
      }));
    },
  });
}

/**
 * A seated member orders for their own seat from the app: paid, a Result with the KOT; their orders reload. The request
 * id, kept to retry an order whose reply was lost, makes the retry the same order rather than a second KOT (F3-18).
 */
export function usePlaceFnbOrder() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lines, requestId }: { lines: readonly FnbLine[]; requestId: string }): Promise<Result<PlacedFnbOrder, FnbFailure>> => {
      const { data, error } = await client.rpc('place_fnb_order', { p_lines: linesJson(lines), p_idempotency_key: requestId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myFnbOrders(userId ?? 'signed-out') });
      return placed(data, error);
    },
  });
}

/** The dealer orders for a seat at the tablet's table: paid, a Result with the KOT; the request id as the app's (F4-10). */
export function useTabletFnbOrder() {
  const { client } = useRivrData();
  return useMutation({
    // Sent whether the browser says it is online or not: offline it fails at once, and never goes later on its own.
    networkMode: 'always',
    mutationFn: async ({ seat, lines, requestId }: { seat: number; lines: readonly FnbLine[]; requestId: string }): Promise<Result<PlacedFnbOrder, FnbFailure>> => {
      const { data, error } = await client.rpc('tablet_fnb_order', { p_seat: seat, p_lines: linesJson(lines), p_idempotency_key: requestId });
      return placed(data, error);
    },
  });
}

/**
 * The console's F&B (#123), for staff who run it: tonight's orders and the KOTs not yet at the bar, ordering for a seat
 * (paid or comp), marking a KOT given by hand, and the menu's items.
 */
export function useFnbOrdersTonight(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.fnbOrdersTonight(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: ORDERS_CHECK,
    queryFn: async (): Promise<FnbOrderTonight[]> => {
      const { data, error } = await client.rpc('fnb_orders_tonight', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        orderId: row.order_id, kotNumber: row.kot_number, tableName: row.table_name, seat: row.seat, memberName: row.member_name,
        memberNumber: Number(row.member_number), lines: linesOf(row.lines), isComp: row.is_comp, source: sourceOf(row.source),
        createdAt: row.created_at, kotSentBy: row.kot_sent_by === 'agent' || row.kot_sent_by === 'staff' ? row.kot_sent_by : null,
        isKotPrintFailed: row.kot_print_failed,
        seatState: row.seat_state === 'leaving' || row.seat_state === 'left' ? row.seat_state : 'seated', acceptedAt: row.accepted_at, deliveredAt: row.delivered_at, ageSeconds: row.age_seconds, onWayAt: row.on_way_at,
        cancelledAt: row.cancelled_at, cancelReason: row.cancel_reason,
      }));
    },
  });
}

function sourceOf(source: string): FnbOrderTonight['source'] {
  return source === 'tablet' || source === 'console' ? source : 'app';
}

/** An order's lines as the database keeps them: name, quantity and note. */
function linesOf(lines: unknown): FnbOrderTonight['lines'] {
  if (!Array.isArray(lines)) return [];
  return lines.map((line: unknown) => {
    const field = (name: string): unknown => (typeof line === 'object' && line !== null ? Reflect.get(line, name) : undefined);
    const note = field('note');
    return { itemId: String(field('item_id')), name: String(field('name')), quantity: Number(field('quantity')), note: typeof note === 'string' ? note : null };
  });
}

/**
 * The console's actions: order for a seat (`comp` only here), once per request id so a retry returns the first order (A3), mark
 * a KOT given to the bar by hand, and keep the menu.
 */
export function useFnbActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.fnbOrdersTonight(userId ?? 'signed-out', venueId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.fnbItems(userId ?? 'signed-out', venueId) }),
  ]);
  const order = useMutation({
    mutationFn: async (input: { tableId: string; seat: number; lines: readonly FnbLine[]; isComp: boolean; requestId: string }): Promise<Result<PlacedFnbOrder, FnbFailure>> => {
      const { data, error } = await client.rpc('console_fnb_order', {
        p_venue_id: venueId, p_table_id: input.tableId, p_seat: input.seat, p_lines: linesJson(input.lines), p_is_comp: input.isComp,
        p_idempotency_key: input.requestId,
      });
      await reload();
      return placed(data, error);
    },
  });
  const markSent = useMutation({
    mutationFn: async (orderId: string): Promise<Result<null, FnbFailure>> => {
      const { error } = await client.rpc('mark_kot_sent', { p_order_id: orderId });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  const saveItem = useMutation({
    mutationFn: async (item: { itemId: string | null; name: string; kind: FnbItemKind; isAvailable: boolean; position: number; diet: FnbDiet | null; description: string | null }): Promise<Result<null, FnbFailure>> => {
      const { error } = await client.rpc('save_fnb_item', {
        p_venue_id: venueId, p_name: item.name.trim(), p_kind: item.kind, p_is_available: item.isAvailable, p_position: item.position,
        ...(item.itemId === null ? {} : { p_item_id: item.itemId }),
        ...(item.diet === null ? {} : { p_diet: item.diet }),
        ...(item.description === null ? {} : { p_description: item.description }),
      });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  return { order, markSent, saveItem };
}

/**
 * Service accepts a placed order, then delivers it (#640, fnb.manage), or voids one not yet delivered with a reason the member
 * sees (decision 0302). Each is a Result, and tonight's orders are read again.
 */
export function useServeFnbOrder(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, FnbFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.fnbOrdersTonight(userId ?? 'signed-out', venueId) });
    return error ? err(error.code === '22023' ? 'taken' : FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const accept = useMutation({ mutationFn: async (orderId: string) => settle((await client.rpc('accept_fnb_order', { p_order_id: orderId })).error) });
  const deliver = useMutation({ mutationFn: async (orderId: string) => settle((await client.rpc('deliver_fnb_order', { p_order_id: orderId })).error) });
  const sendOnWay = useMutation({ mutationFn: async (orderId: string) => settle((await client.rpc('send_fnb_order_on_way', { p_order_id: orderId })).error) });
  const cancel = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) =>
      settle((await client.rpc('cancel_fnb_order', { p_order_id: orderId, p_reason: reason })).error),
  });
  return { accept, sendOnWay, deliver, cancel };
}

/** Every item on the venue's menu, on offer or not, in menu order, for staff who run F&B. */
export function useFnbItems(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.fnbItems(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<FnbItem[]> => {
      const { data, error } = await client.from('fnb_item').select('id, name, kind, is_available, position, photo_path, diet, description').eq('venue_id', venueId)
        .order('position').order('name');
      if (error) throw error;
      return data.map((row) => ({
        itemId: row.id, name: row.name, kind: row.kind, isAvailable: row.is_available, position: row.position, photoUrl: itemPhotoUrl(client, row.photo_path),
        diet: dietOf(row.diet), description: row.description,
      }));
    },
  });
}
