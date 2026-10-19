import { err, ok, type Result } from '@rivr/contracts/result';
import type { BuyInMethod } from '@rivr/domain/cage';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A member as the cage sees them (#57): KYC, wallet cash, bonus, markers, where they sit and the table's minimum. */
export interface CageMember {
  readonly memberId: string;
  readonly fullName: string;
  readonly tierName: string;
  readonly isKycComplete: boolean;
  readonly photoPath: string | null;
  readonly wallet: Paise;
  readonly bonus: Paise;
  readonly markers: Paise;
  /** Where they sit, with the table's minimum buy-in; null when not seated. */
  readonly seat: { readonly tableName: string; readonly number: number; readonly minimum: Paise } | null;
  readonly breakUntil: string | null;
}

/** A buy-in the table asked the cage for, waiting (flow 3). */
export interface BuyInRequest {
  readonly requestId: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly tableName: string;
  readonly seat: number;
  readonly amount: Paise;
  readonly requestedAt: string;
  readonly photoPath: string | null;
}

/**
 * Why a buy-in or cash-out did not go through; `moved` is a request from a seat the player has since left, `not_in_room` a
 * cash-out for a member not checked in.
 */
export type CageFailure = 'not_allowed' | 'no_member' | 'stopped' | 'paused' | 'kyc_needed' | 'on_break' | 'not_seated'
  | 'not_chips' | 'below_minimum' | 'wallet_short' | 'utr_used' | 'moved' | 'not_in_room' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, CageFailure>> = {
  '42501': 'not_allowed', RVNOM: 'no_member', RVMBR: 'stopped', RVFRZ: 'paused', RVKYC: 'kyc_needed', RVBRK: 'on_break', RVOUT: 'not_in_room',
  RVNST: 'not_seated', RVCHP: 'not_chips', RVMIN: 'below_minimum', RVSHT: 'wallet_short', RVUTR: 'utr_used', RVSTL: 'moved', '22023': 'invalid',
};

// The queue fills from the tables; the cashier sees a request within seconds.
const LIVE = 5_000;

/** Members the cashier finds by name or mobile number (two characters or more). */
export function useCageMembers(venueId: string, query: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.cageMembers(userId ?? 'signed-out', venueId, query.trim()),
    enabled: userId !== null && query.trim().length >= 2,
    queryFn: async (): Promise<CageMember[]> => {
      const { data, error } = await client.rpc('cage_members', { p_venue_id: venueId, p_query: query.trim() });
      if (error) throw error;
      return data.map((row) => ({
        memberId: row.member_id, fullName: row.full_name, tierName: row.tier_name, isKycComplete: row.is_kyc_complete, photoPath: row.photo_path,
        wallet: toPaise(row.wallet_paise), bonus: toPaise(row.bonus_paise), markers: toPaise(row.markers_paise), breakUntil: row.break_until,
        seat: row.table_name === null || row.seat === null || row.minimum_paise === null ? null
          : { tableName: row.table_name, number: row.seat, minimum: toPaise(row.minimum_paise) },
      }));
    },
  });
}

/** The cage's queue: buy-ins the tables asked for, oldest first. */
export function useCageQueue(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.cageQueue(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<BuyInRequest[]> => {
      const { data, error } = await client.rpc('cage_queue', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        requestId: row.request_id, memberId: row.member_id, fullName: row.full_name, tableName: row.table_name, seat: row.seat,
        amount: toPaise(row.amount_paise), requestedAt: row.requested_at, photoPath: row.photo_path,
      }));
    },
  });
}

/** A buy-in to issue: once per request id; from a waiting request when `buyInRequestId` is given. */
export interface BuyInOrder {
  readonly memberId: string;
  readonly amount: Paise;
  readonly method: BuyInMethod;
  readonly utr: string | null;
  readonly requestId: string;
  readonly buyInRequestId: string | null;
}

/** A cash-out to make (#75): chips handed back, to cash or the wallet, once per request id. */
export interface CashOutOrder {
  readonly memberId: string;
  readonly amount: Paise;
  readonly to: 'cash' | 'wallet';
  readonly requestId: string;
}

/** What a cash-out came to (#75): what it settled on markers, and what the member got in cash or to the wallet. */
export interface CashOutDone {
  readonly cageTransactionId: string;
  readonly settled: Paise;
  readonly toMember: Paise;
}

/**
 * `buyIn` issues chips, `decline` turns a request down, and `cashOut` takes chips back, settling open
 * markers first (#75); each is a Result and reloads the cage.
 */
export function useCageActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
  const buyIn = useMutation({
    mutationFn: async (order: BuyInOrder): Promise<Result<string, CageFailure>> => {
      const { data, error } = await client.rpc('cage_buy_in', {
        p_venue_id: venueId, p_member_id: order.memberId, p_amount_paise: Number(order.amount), p_method: order.method,
        p_idempotency_key: order.requestId, ...(order.utr === null ? {} : { p_utr: order.utr }),
        ...(order.buyInRequestId === null ? {} : { p_buy_in_request_id: order.buyInRequestId }),
      });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
  const decline = useMutation({
    mutationFn: async (requestId: string): Promise<Result<null, CageFailure>> => {
      const { error } = await client.rpc('decline_buy_in_request', { p_request_id: requestId });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  const cashOut = useMutation({
    mutationFn: async (order: CashOutOrder): Promise<Result<CashOutDone, CageFailure>> => {
      const { data, error } = await client.rpc('cage_cash_out', {
        p_venue_id: venueId, p_member_id: order.memberId, p_amount_paise: Number(order.amount), p_to: order.to, p_idempotency_key: order.requestId,
      });
      await reload();
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      const row = data[0];
      return row === undefined ? err('unavailable')
        : ok({ cageTransactionId: row.cage_transaction_id, settled: toPaise(row.markers_settled_paise), toMember: toPaise(row.to_member_paise) });
    },
  });
  return { buyIn, decline, cashOut };
}
