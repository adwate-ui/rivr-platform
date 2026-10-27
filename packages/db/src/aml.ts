import { err, ok, type Result } from '@rivr/contracts/result';
import { fromPaise, type Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The pattern an entry is about (#105): several visits, or club days, of cash buy-ins ended just under the limit. */
export type SarKind = 'structuring_visit' | 'structuring_day';

/** What review found. */
export type SarOutcome = 'no_action' | 'monitor' | 'reported';

/** One cash in an entry is about: a cash buy-in at the cage, or a tournament entry paid in cash. */
export interface SarBuyIn {
  readonly id: string;
  readonly source: 'cage' | 'tournament';
  readonly at: string;
  readonly amount: Paise;
}

/** One entry of the suspicious-activity register (#105, decision 0234), with its review once made. */
export interface SarEntry {
  readonly id: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly kind: SarKind;
  readonly detectedAt: string;
  readonly isOpen: boolean;
  readonly outcome: SarOutcome | null;
  readonly note: string | null;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  /** The cash in's total. */
  readonly cash: Paise;
  readonly buyIns: readonly SarBuyIn[];
}

/** Why a review did not go through. */
export type SarReviewFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, SarReviewFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused' };

const isKind = (kind: string): kind is SarKind => kind === 'structuring_visit' || kind === 'structuring_day';
const isOutcome = (outcome: string | null): outcome is SarOutcome => outcome === 'no_action' || outcome === 'monitor' || outcome === 'reported';

function buyInsOf(value: Json): SarBuyIn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const field = (name: string): unknown => (typeof item === 'object' && item !== null ? Reflect.get(item, name) : undefined);
    const [id, source, at, amount] = [field('id'), field('source'), field('at'), field('amount_paise')];
    if (typeof id !== 'string' || (source !== 'cage' && source !== 'tournament') || typeof at !== 'string' || typeof amount !== 'number') return [];
    return [{ id, source, at, amount: fromPaise(BigInt(amount)) }];
  });
}

/** The venue's register, open entries first, for staff who review AML; asked every minute. */
export function useAmlRegister(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.amlRegister(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: 60_000,
    queryFn: async (): Promise<SarEntry[]> => {
      const { data, error } = await client.rpc('aml_register', { p_venue_id: venueId });
      if (error) throw error;
      return data.filter((row) => isKind(row.kind)).map((row) => ({
        id: row.entry_id, memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number,
        kind: isKind(row.kind) ? row.kind : 'structuring_visit', detectedAt: row.detected_at, isOpen: row.status === 'open',
        outcome: isOutcome(row.outcome) ? row.outcome : null, note: row.note, reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at,
        cash: fromPaise(BigInt(row.cash_paise)), buyIns: buyInsOf(row.buy_ins),
      }));
    },
  });
}

/** Closes an open entry with an outcome and a note; a Result, and the register reloads. */
export function useReviewSarEntry(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, outcome, note }: { entryId: string; outcome: SarOutcome; note: string }): Promise<Result<null, SarReviewFailure>> => {
      const { error } = await client.rpc('review_sar_entry', { p_entry_id: entryId, p_outcome: outcome, p_note: note.trim() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.amlRegister(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}
