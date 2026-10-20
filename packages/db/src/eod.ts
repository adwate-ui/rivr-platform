import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import type { ChipCount } from './treasury.ts';

/** One of a close's four figures: what was counted, what the ledger expected, and the variance (below zero when short). */
export interface CloseFigure {
  readonly counted: Paise;
  readonly expected: Paise;
  readonly variance: Paise;
}

/** An anomaly's review: the reason, who gave it and when. */
export interface CloseReview {
  readonly reason: string;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
}

/** A cage shift's end-of-day close (#45): the shift, its four figures, and an anomaly's review, null while it waits. */
export interface EodClose {
  readonly closeId: string;
  readonly openedAt: string;
  readonly openedBy: string;
  readonly float: Paise;
  readonly closedAt: string;
  readonly closedBy: string;
  /** An anomaly waiting for its reason that the signed-in staff member may give: a manager who neither opened nor closed the shift. */
  readonly mayReview: boolean;
  readonly cash: CloseFigure;
  readonly chips: CloseFigure;
  readonly receipts: CloseFigure;
  readonly markers: CloseFigure;
  /** Any variance at all: the day closes only once a reviewer gives the reason. */
  readonly isAnomaly: boolean;
  readonly review: CloseReview | null;
}

/** A close to make: the cash counted, the chips counted, the UPI and bank receipts and the markers held; once per request id. */
export interface CloseOrder {
  readonly cash: Paise;
  readonly counts: readonly ChipCount[];
  readonly receipts: Paise;
  readonly markers: Paise;
  readonly requestId: string;
}

/** Why a close or a review was refused: no shift open, a count or reason not right, not allowed, reviewed already or nothing to review, or the server unreachable. */
export type EodFailure = 'no_shift' | 'invalid' | 'not_allowed' | 'no_review' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, EodFailure>> = { RVNSH: 'no_shift', '22023': 'invalid', '42501': 'not_allowed', RVREV: 'no_review' };

const failureOf = (code: string): EodFailure => FAILURE_BY_CODE[code] ?? 'unavailable';
const figure = (counted: number, expected: number, variance: number): CloseFigure =>
  ({ counted: toPaise(counted), expected: toPaise(expected), variance: toPaise(variance) });

interface CloseRow {
  close_id: string; opened_at: string; opened_by: string; float_paise: number; closed_at: string; closed_by: string; may_review: boolean;
  counted_cash_paise: number; counted_chips_paise: number; counted_receipts_paise: number; counted_markers_paise: number;
  expected_cash_paise: number; expected_chips_paise: number; expected_receipts_paise: number; expected_markers_paise: number;
  cash_variance_paise: number; chips_variance_paise: number; receipts_variance_paise: number; markers_variance_paise: number;
  is_anomaly: boolean; reason: string | null; reviewed_by: string | null; reviewed_at: string | null;
}

function toClose(row: CloseRow): EodClose {
  return {
    closeId: row.close_id, openedAt: row.opened_at, openedBy: row.opened_by, float: toPaise(row.float_paise), closedAt: row.closed_at,
    closedBy: row.closed_by, mayReview: row.may_review,
    cash: figure(row.counted_cash_paise, row.expected_cash_paise, row.cash_variance_paise),
    chips: figure(row.counted_chips_paise, row.expected_chips_paise, row.chips_variance_paise),
    receipts: figure(row.counted_receipts_paise, row.expected_receipts_paise, row.receipts_variance_paise),
    markers: figure(row.counted_markers_paise, row.expected_markers_paise, row.markers_variance_paise),
    isAnomaly: row.is_anomaly,
    review: row.reason === null || row.reviewed_by === null || row.reviewed_at === null ? null
      : { reason: row.reason, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at },
  };
}

/** The venue's latest closes, newest first, for ledger readers. */
export function useEodCloses(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.eodCloses(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<EodClose[]> => {
      const { data, error } = await client.rpc('eod_closes', { p_venue_id: venueId });
      if (error) throw error;
      return data.map(toClose);
    },
  });
}

/**
 * The end of day's steps (#45): `close` the open shift, a Result with the close's id; `review` an
 * anomaly with its reason. Each reloads the closes and the Treasury.
 */
export function useEodActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.eodCloses(userId ?? 'signed-out', venueId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.treasury(userId ?? 'signed-out', venueId) }),
  ]);
  const close = useMutation({
    mutationFn: async (order: CloseOrder): Promise<Result<string, EodFailure>> => {
      const { data, error } = await client.rpc('close_cage_shift', {
        p_venue_id: venueId, p_cash_paise: Number(order.cash), p_receipts_paise: Number(order.receipts), p_markers_paise: Number(order.markers),
        p_counts: order.counts.map((count) => ({ value_paise: Number(count.value), quantity: count.quantity })), p_idempotency_key: order.requestId,
      });
      await reload();
      return error ? err(failureOf(error.code)) : ok(data);
    },
  });
  const review = useMutation({
    mutationFn: async ({ closeId, reason }: { closeId: string; reason: string }): Promise<Result<null, EodFailure>> => {
      const { error } = await client.rpc('review_eod_close', { p_close_id: closeId, p_reason: reason });
      await reload();
      return error ? err(failureOf(error.code)) : ok(null);
    },
  });
  return { close, review };
}
