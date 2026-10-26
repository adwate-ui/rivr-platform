import type { Holding } from '@rivr/contracts/shareholding';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/shareholding), off the player's first load.
const keys = {
  shareholdingRegister: (userId: string, venueId: string, on: string) => ['user', userId, 'shareholding-register', venueId, on] as const,
  shareholdingHistory: (userId: string, venueId: string) => ['user', userId, 'shareholding-history', venueId] as const,
};

/** A holder on the register on a day (#97): a partner or an investor, with their share then, or null before their first. */
export interface RegisterRow {
  readonly shareholderId: string;
  readonly name: string;
  readonly kind: 'partner' | 'investor';
  readonly basisPoints: number | null;
  /** The day the share in force began, `2026-06-01`. */
  readonly effectiveFrom: string | null;
}

/** A holding as recorded, newest day first, with who recorded it. */
export interface HoldingRecord {
  readonly shareholderId: string;
  readonly name: string;
  readonly basisPoints: number;
  readonly effectiveFrom: string;
  readonly note: string | null;
  readonly recordedBy: string;
  readonly recordedAt: string;
}

/** Why a change to the register did not go through: not a super admin, not allowed as asked, above 100% on a day, or anything else. */
export type RegisterFailure = 'not_allowed' | 'invalid' | 'above_whole' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, RegisterFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVSHR: 'above_whole' };

/** The register on a day (`2026-10-26`), largest holding first, for super admins. */
export function useShareholdingRegister(venueId: string, on: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.shareholdingRegister(userId ?? 'signed-out', venueId, on),
    enabled: userId !== null,
    queryFn: async (): Promise<RegisterRow[]> => {
      const { data, error } = await client.rpc('shareholding_register', { p_venue_id: venueId, p_on: on });
      if (error) throw error;
      return data.map((row) => ({
        shareholderId: row.shareholder_id, name: row.name, kind: row.kind === 'investor' ? 'investor' : 'partner', basisPoints: row.basis_points,
        effectiveFrom: row.effective_from,
      }));
    },
  });
}

/** Every holding recorded, newest day first. */
export function useShareholdingHistory(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.shareholdingHistory(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<HoldingRecord[]> => {
      const { data, error } = await client.rpc('shareholding_history', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        shareholderId: row.shareholder_id, name: row.name, basisPoints: row.basis_points, effectiveFrom: row.effective_from, note: row.note,
        recordedBy: row.recorded_by, recordedAt: row.recorded_at,
      }));
    },
  });
}

/** `addHolder` and `recordHolding`, each a Result, reloading the register and its history. */
export function useShareholdingActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <Value,>(data: Value, error: { code: string } | null): Promise<Result<Value, RegisterFailure>> => {
    await queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
  };
  const addHolder = useMutation({
    mutationFn: async ({ name, kind }: { name: string; kind: 'partner' | 'investor' }) => {
      const { data, error } = await client.rpc('add_shareholder', { p_venue_id: venueId, p_name: name.trim(), p_kind: kind });
      return settle(data, error);
    },
  });
  const recordHolding = useMutation({
    mutationFn: async (holding: Holding) => {
      const { error } = await client.rpc('record_holding', {
        p_venue_id: venueId, p_shareholder_id: holding.shareholderId, p_basis_points: holding.percent, p_effective_from: holding.effectiveFrom,
        p_note: holding.note,
      });
      return settle(null, error);
    },
  });
  return { addHolder, recordHolding };
}
