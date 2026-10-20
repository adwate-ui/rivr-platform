import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { ruleAt } from '@rivr/domain/settings';
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

/** A rake change to schedule: a table type's new rate and cap, from a time. */
export interface RakeChange {
  readonly tableTypeCode: string;
  readonly rateBasisPoints: number;
  readonly cap: Paise;
  readonly effectiveFrom: string;
  readonly reason: string;
}

/**
 * Why a change did not go through: the role does not manage settings; the change was refused (one
 * already at that time for the table type, or a value the database refuses); a time too soon, or a
 * change too close to taking effect to withdraw, since a tablet may already have used it; or anything else.
 */
export type RakeChangeFailure = 'not_allowed' | 'invalid' | 'too_soon' | 'unavailable';

// RVMIN: the database's own minute (#323), on its clock, which this device's may not match.
const FAILURE_BY_CODE: Readonly<Record<string, RakeChangeFailure>> = { '42501': 'not_allowed', '23514': 'invalid', '23505': 'invalid', RVMIN: 'too_soon' };

// A tablet logs a hand with its own clock, up to a minute ahead of the server's (log_hand), so a
// change is scheduled, and withdrawn, only while it is more than a minute away.
const CLOCK_GRACE = 60_000;

// Clocks disagree, so a change this close that the database kept was within its minute (#323).
const CLOCK_DOUBT = 5 * 60_000;

// A change comes into force on its own, so the screen asks again every minute.
const RAKE_CHECK = 60_000;

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
        client.from('setting').select('id, subject, value, effective_from, reason').eq('venue_id', venueId).eq('key', 'rake.config'),
      ]);
      if (types.error) throw types.error;
      if (settings.error) throw settings.error;
      const now = new Date();
      return types.data.map((type) => ({
        tableTypeId: type.id, code: type.code, name: type.name, smallBlind: toPaise(type.small_blind_paise), bigBlind: toPaise(type.big_blind_paise),
        ...ruleAt(settings.data.filter((row) => row.subject === type.code).map(toRakeSetting), now),
      }));
    },
  });
}

/** True while a change is more than a minute away: it can be scheduled, or withdrawn. */
function isClearOfHands(effectiveFrom: string): boolean {
  return Date.parse(effectiveFrom) > Date.now() + CLOCK_GRACE;
}

/**
 * Staff with settings.manage `schedule` a rake change for a table type from a time more than a
 * minute away, and `withdraw` one still more than a minute away. Hands keep the rule in force when
 * they were played. Both reload the venue's rake.
 */
export function useRakeChangeActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: queryKeys.tableTypeRake(userId ?? 'signed-out', venueId) });
  const schedule = useMutation({
    mutationFn: async (change: RakeChange): Promise<Result<null, RakeChangeFailure>> => {
      if (!isClearOfHands(change.effectiveFrom)) return err('too_soon');
      const { error } = await client.from('setting').insert({
        venue_id: venueId, key: 'rake.config', subject: change.tableTypeCode, effective_from: change.effectiveFrom, reason: change.reason,
        value: { rate_basis_points: change.rateBasisPoints, cap_paise: Number(change.cap) },
      });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  const withdraw = useMutation({
    mutationFn: async (settingId: string): Promise<Result<null, RakeChangeFailure>> => {
      const found = await client.from('setting').select('effective_from').eq('id', settingId).maybeSingle();
      if (found.error) return err('unavailable');
      if (found.data === null) {
        // Withdrawn already, here or by someone else: what was asked for is done.
        await reload();
        return ok(null);
      }
      if (!isClearOfHands(found.data.effective_from)) return err('too_soon');
      const { data, error } = await client.from('setting').delete().eq('id', settingId).select('id');
      await reload();
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      if (data.length === 1) return ok(null);
      return err(Date.parse(found.data.effective_from) <= Date.now() + CLOCK_DOUBT ? 'too_soon' : 'not_allowed');
    },
  });
  return { schedule, withdraw };
}
