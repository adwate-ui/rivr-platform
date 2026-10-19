import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { toRakeSetting, type RakeSetting } from './parse/rakeSettings.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

export type { RakeSetting };

/** A table type with its rake: the rule in force now, and the changes to come, soonest first. */
export interface TableTypeRake {
  readonly tableTypeId: string;
  readonly code: string;
  readonly name: string;
  readonly smallBlind: Paise;
  readonly bigBlind: Paise;
  readonly inForce: RakeSetting | null;
  readonly scheduled: readonly RakeSetting[];
}

/** A rake change to schedule: rake.config's values for one table type, from a time. */
export interface RakeChange {
  readonly tableTypeCode: string;
  readonly rateBasisPoints: number;
  readonly capPaise: number;
  readonly effectiveFrom: string;
  readonly reason: string;
}

/**
 * Why a change did not go through: the role does not manage settings, the change was refused (a
 * time in the past, or another change for that table type at the same time), a change already in
 * force (it stays; schedule another), or anything else.
 */
export type RakeChangeFailure = 'not_allowed' | 'invalid' | 'in_force' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, RakeChangeFailure>> = { '42501': 'not_allowed', '23514': 'invalid', '23505': 'invalid' };

// A change comes into force on its own, so the screen asks again every minute.
const RAKE_CHECK = 60_000;

/** Splits a table type's rows (newest first) into the rule in force at `now` and the changes to come. */
function inForceAndScheduled(rows: readonly RakeSetting[], now: number): Pick<TableTypeRake, 'inForce' | 'scheduled'> {
  const isLater = (row: RakeSetting) => row.effectiveFrom !== null && Date.parse(row.effectiveFrom) > now;
  return { inForce: rows.find((row) => !isLater(row)) ?? null, scheduled: rows.filter(isLater).reverse() };
}

/** The venue's table types with their rake (#37), for staff; asked again every minute. */
export function useTableTypeRake(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tableTypeRake(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: RAKE_CHECK,
    queryFn: async (): Promise<TableTypeRake[]> => {
      const [types, settings] = await Promise.all([
        client.from('table_type').select('id, code, name, small_blind_paise, big_blind_paise').eq('venue_id', venueId)
          .order('small_blind_paise').order('name'),
        client.from('setting').select('id, subject, value, effective_from, reason').eq('venue_id', venueId).eq('key', 'rake.config')
          .order('effective_from', { ascending: false }),
      ]);
      if (types.error) throw types.error;
      if (settings.error) throw settings.error;
      const now = Date.now();
      return types.data.map((type) => ({
        tableTypeId: type.id, code: type.code, name: type.name, smallBlind: toPaise(type.small_blind_paise), bigBlind: toPaise(type.big_blind_paise),
        ...inForceAndScheduled(settings.data.filter((row) => row.subject === type.code).map(toRakeSetting), now),
      }));
    },
  });
}

/**
 * Staff with settings.manage `schedule` a rake change for a table type from a time (now or later),
 * and `withdraw` one not yet in force. Hands keep the rule in force when they were played. Both
 * reload the venue's rake.
 */
export function useRakeChangeActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: queryKeys.tableTypeRake(userId ?? 'signed-out', venueId) });
  const schedule = useMutation({
    mutationFn: async (change: RakeChange): Promise<Result<null, RakeChangeFailure>> => {
      const { error } = await client.from('setting').insert({
        venue_id: venueId, key: 'rake.config', subject: change.tableTypeCode, effective_from: change.effectiveFrom, reason: change.reason,
        value: { rate_basis_points: change.rateBasisPoints, cap_paise: change.capPaise },
      });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  const withdraw = useMutation({
    mutationFn: async (settingId: string): Promise<Result<null, RakeChangeFailure>> => {
      // Row-level security withdraws only a change not yet in force; one already in force is left as it is.
      const { data, error } = await client.from('setting').delete().eq('id', settingId).select('id');
      await reload();
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      return data.length === 1 ? ok(null) : err('in_force');
    },
  });
  return { schedule, withdraw };
}
