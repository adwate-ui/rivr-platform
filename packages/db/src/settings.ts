import { err, ok, type Result } from '@rivr/contracts/result';
import { STAFF_ROLES } from '@rivr/contracts/roles';
import type { SettingScope } from '@rivr/contracts/settings';
import { ruleAt } from '@rivr/domain/settings';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { toSettingFields, toSettingValue, type SettingField, type SettingValue } from './parse/settings.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

export type { SettingField, SettingValue };

/** One stored value of a setting, for one subject, from a moment on. */
export interface SettingEntry {
  readonly settingId: string;
  readonly value: SettingValue;
  /** Null for a value in force since the venue opened (stored as -infinity). */
  readonly effectiveFrom: string | null;
  readonly reason: string | null;
}

/** A setting for one subject (a table type, tier, stake or role; empty for the venue): now, to come, and before. */
export interface SettingSubjectRules {
  readonly subject: string;
  /** The table type's or tier's name; the subject itself for a role or a stake. */
  readonly label: string;
  readonly inForce: SettingEntry | null;
  /** Changes to come, soonest first; each can be withdrawn until it takes effect. */
  readonly scheduled: readonly SettingEntry[];
  /** Values that were in force before, latest first. */
  readonly history: readonly SettingEntry[];
}

/** A setting key as the Settings screen shows it (#33). */
export interface VenueSetting {
  readonly key: string;
  readonly description: string;
  readonly scope: SettingScope;
  readonly fields: readonly SettingField[];
  readonly subjects: readonly SettingSubjectRules[];
}

/** A subject a new value can be given for, in the scope's own order. */
interface Subject {
  readonly subject: string;
  readonly label: string;
}

/** The venue's settings, and its tiers for a field that names one. */
export interface VenueSettings {
  readonly settings: readonly VenueSetting[];
  readonly tiers: readonly Subject[];
}

/** A value to schedule: from now (null, by the database's clock) or from a moment, and why. */
export interface SettingChange {
  readonly key: string;
  readonly subject: string;
  readonly value: SettingValue;
  readonly effectiveFrom: string | null;
  readonly reason: string;
}

/**
 * Why a change did not go through: the role does not manage settings; the database refused the value
 * (its schema) or the moment (the past); a change for that subject is already set for that moment; a
 * money key's change within a minute (RVMIN, #323); a change already in force, which is never withdrawn;
 * or anything else.
 */
export type SettingFailure = 'not_allowed' | 'invalid' | 'taken' | 'too_soon' | 'in_force' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, SettingFailure>> = { '42501': 'not_allowed', '23514': 'invalid', '23505': 'taken', RVMIN: 'too_soon' };

// A value comes into force on its own, so the screen asks again every minute.
const SETTINGS_CHECK = 60_000;

interface SettingRow {
  readonly id: string;
  readonly key: string;
  readonly subject: string;
  readonly value: SettingValue;
  readonly effectiveFrom: string | null;
  readonly reason: string | null;
}

const toEntry = ({ id, value, effectiveFrom, reason }: SettingRow): SettingEntry => ({ settingId: id, value, effectiveFrom, reason });

/** The subjects of one key: those its scope offers, then any others its rows name (a table type since removed). */
function subjectsOf(known: readonly Subject[], rows: readonly SettingRow[], now: Date): SettingSubjectRules[] {
  const named = new Set(known.map((one) => one.subject));
  const others = [...new Set(rows.map((row) => row.subject))].filter((subject) => !named.has(subject)).map((subject) => ({ subject, label: subject }));
  return [...known, ...others].map(({ subject, label }) => {
    const own = rows.filter((row) => row.subject === subject);
    const { inForce, scheduled } = ruleAt(own, now);
    const history = own.filter((row) => row !== inForce && !scheduled.includes(row))
      .sort((a, b) => (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? ''));
    return { subject, label, inForce: inForce && toEntry(inForce), scheduled: scheduled.map(toEntry), history: history.map(toEntry) };
  });
}

async function readSettings(client: RivrClient, venueId: string): Promise<VenueSettings> {
  const [keys, rows, types, tiers] = await Promise.all([
    client.from('setting_key').select('key, description, scope, value_schema').order('key'),
    client.from('setting').select('id, key, subject, value, effective_from, reason').eq('venue_id', venueId),
    client.from('table_type').select('code, name').eq('venue_id', venueId).order('small_blind_paise').order('name'),
    client.from('tier').select('id, name').eq('venue_id', venueId).order('rank'),
  ]);
  for (const read of [keys, rows, types, tiers]) if (read.error) throw read.error;
  const tierSubjects = (tiers.data ?? []).map((tier) => ({ subject: tier.id, label: tier.name }));
  const known: Readonly<Record<SettingScope, readonly Subject[]>> = {
    venue: [{ subject: '', label: '' }],
    table_type: (types.data ?? []).map((type) => ({ subject: type.code, label: type.name })),
    tier: tierSubjects,
    role: STAFF_ROLES.map((role) => ({ subject: role, label: role })),
    stake: [],
  };
  const settingRows = (rows.data ?? []).map((row) => ({
    id: row.id, key: row.key, subject: row.subject, value: toSettingValue(row.value), reason: row.reason,
    effectiveFrom: row.effective_from === '-infinity' ? null : row.effective_from,
  }));
  const now = new Date();
  const settings = (keys.data ?? []).map((definition) => ({
    key: definition.key, description: definition.description, scope: definition.scope, fields: toSettingFields(definition.value_schema),
    subjects: subjectsOf(known[definition.scope], settingRows.filter((row) => row.key === definition.key), now),
  }));
  return { settings, tiers: tierSubjects };
}

/** Every setting key with its values at the venue, for staff (#33); asked again every minute. */
export function useVenueSettings(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueSettings(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: SETTINGS_CHECK,
    queryFn: () => readSettings(client, venueId),
  });
}

/**
 * Staff with settings.manage `schedule` a value from now or a later moment, which the database checks
 * against the key's schema, and `withdraw` one not yet in force. Both reload the venue's settings.
 */
export function useSettingActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: queryKeys.venueSettings(userId ?? 'signed-out', venueId) });
  const schedule = useMutation({
    mutationFn: async (change: SettingChange): Promise<Result<null, SettingFailure>> => {
      // From now is by the database's clock (the column's default), which this device's may not match.
      const { error } = await client.from('setting').insert({
        venue_id: venueId, key: change.key, subject: change.subject, value: change.value, reason: change.reason,
        ...(change.effectiveFrom === null ? {} : { effective_from: change.effectiveFrom }),
      });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  const withdraw = useMutation({
    mutationFn: async (settingId: string): Promise<Result<null, SettingFailure>> => {
      const { data, error } = await client.from('setting').delete().eq('id', settingId).select('id');
      if (error) {
        await reload();
        return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      }
      if (data.length === 1) {
        await reload();
        return ok(null);
      }
      // Nothing withdrawn: someone withdrew it already (done), it took effect, or it is a money key's
      // change within a minute of taking effect (#323).
      const left = await client.from('setting').select('effective_from').eq('id', settingId).maybeSingle();
      await reload();
      if (left.data === null) return ok(null);
      return err(Date.parse(left.data.effective_from) <= Date.now() ? 'in_force' : 'too_soon');
    },
  });
  return { schedule, withdraw };
}
