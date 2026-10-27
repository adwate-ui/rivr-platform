import { err, ok, type FnbItemKind, type FnbLine, type Result } from '@rivr/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** An item on the table-side menu (#123): Glaza's, no price. */
export interface FnbMenuItem {
  readonly itemId: string;
  readonly name: string;
  readonly kind: FnbItemKind;
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
  readonly lines: readonly { name: string; quantity: number; note: string | null }[];
  readonly isComp: boolean;
  readonly source: 'app' | 'tablet' | 'console';
  readonly createdAt: string;
  /** Null while the bar has not been given the KOT: the agent prints it, or staff hand it over and mark it. */
  readonly kotSentBy: 'agent' | 'staff' | null;
}

/**
 * Why an order did not go through: not allowed (the tier, the role, or not a tablet), nobody seated there, an item no
 * longer on the menu, a second app order inside the minute, alcohol under 21, no dealer on the tablet, the venue
 * frozen, a malformed order, or anything else.
 */
export type FnbFailure = 'not_allowed' | 'not_seated' | 'not_on_menu' | 'too_soon' | 'too_young' | 'no_dealer' | 'paused' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, FnbFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVFNS: 'not_seated', RVFNI: 'not_on_menu', RVFST: 'too_soon', RVAGE: 'too_young',
  RVDWN: 'no_dealer', RVFRZ: 'paused', RVMBR: 'not_allowed',
};

// The console's KOTs to print and tonight's orders ask again every ten seconds: orders arrive from the tables.
const ORDERS_CHECK = 10_000;

interface PlacedRow { order_id: string; kot_number: number }

function placed(data: readonly PlacedRow[] | null, error: { code: string } | null): Result<PlacedFnbOrder, FnbFailure> {
  if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
  const row = data?.[0];
  return row ? ok({ orderId: row.order_id, kotNumber: row.kot_number }) : err('unavailable');
}

/** Order lines as the database takes them. */
function linesJson(lines: readonly FnbLine[]) {
  return lines.map((line) => ({ item_id: line.item_id, quantity: line.quantity, note: line.note ?? null }));
}

function menuItem(row: { item_id: string; name: string; kind: FnbItemKind }): FnbMenuItem {
  return { itemId: row.item_id, name: row.name, kind: row.kind };
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
      return data.map(menuItem);
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
      return data.map(menuItem);
    },
  });
}

/** A seated member orders for their own seat from the app: paid, a Result with the KOT. */
export function usePlaceFnbOrder() {
  const { client } = useRivrData();
  return useMutation({
    mutationFn: async (lines: readonly FnbLine[]): Promise<Result<PlacedFnbOrder, FnbFailure>> => {
      const { data, error } = await client.rpc('place_fnb_order', { p_lines: linesJson(lines) });
      return placed(data, error);
    },
  });
}

/** The dealer orders for a seat at the tablet's table: paid, a Result with the KOT. */
export function useTabletFnbOrder() {
  const { client } = useRivrData();
  return useMutation({
    mutationFn: async ({ seat, lines }: { seat: number; lines: readonly FnbLine[] }): Promise<Result<PlacedFnbOrder, FnbFailure>> => {
      const { data, error } = await client.rpc('tablet_fnb_order', { p_seat: seat, p_lines: linesJson(lines) });
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
    return { name: String(field('name')), quantity: Number(field('quantity')), note: typeof note === 'string' ? note : null };
  });
}

/** The console's actions: order for a seat (`comp` only here), mark a KOT given to the bar by hand, and keep the menu. */
export function useFnbActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.fnbOrdersTonight(userId ?? 'signed-out', venueId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.fnbItems(userId ?? 'signed-out', venueId) }),
  ]);
  const order = useMutation({
    mutationFn: async (input: { tableId: string; seat: number; lines: readonly FnbLine[]; isComp: boolean }): Promise<Result<PlacedFnbOrder, FnbFailure>> => {
      const { data, error } = await client.rpc('console_fnb_order', {
        p_venue_id: venueId, p_table_id: input.tableId, p_seat: input.seat, p_lines: linesJson(input.lines), p_is_comp: input.isComp,
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
    mutationFn: async (item: { itemId: string | null; name: string; kind: FnbItemKind; isAvailable: boolean; position: number }): Promise<Result<null, FnbFailure>> => {
      const { error } = await client.rpc('save_fnb_item', {
        p_venue_id: venueId, p_name: item.name.trim(), p_kind: item.kind, p_is_available: item.isAvailable, p_position: item.position,
        ...(item.itemId === null ? {} : { p_item_id: item.itemId }),
      });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  return { order, markSent, saveItem };
}

/** Every item on the venue's menu, on offer or not, in menu order, for staff who run F&B. */
export function useFnbItems(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.fnbItems(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<FnbItem[]> => {
      const { data, error } = await client.from('fnb_item').select('id, name, kind, is_available, position').eq('venue_id', venueId)
        .order('position').order('name');
      if (error) throw error;
      return data.map((row) => ({ itemId: row.id, name: row.name, kind: row.kind, isAvailable: row.is_available, position: row.position }));
    },
  });
}
