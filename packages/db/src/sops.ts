import { err, ok, type Result } from '@rivr/contracts/result';
import type { StaffRole } from '@rivr/contracts/roles';
import { sopWaitingSchema } from '@rivr/contracts/sops';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from './database.types.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** One version of an SOP (#51): its owner by job title, the roles that must acknowledge it, its IST day and its text. */
export interface SopVersion {
  readonly versionId: string;
  readonly version: number;
  readonly owner: string;
  readonly ackRoles: readonly StaffRole[];
  /** `2026-11-01`: in force from this IST day until a later version's day comes. */
  readonly effectiveOn: string;
  readonly body: string;
}

/** An SOP in the venue's library, as the signed-in staff member sees it. */
export interface Sop {
  readonly sopId: string;
  readonly title: string;
  /** The version in force; null for an SOP whose first day is still to come. */
  readonly current: SopVersion | null;
  /** Every version waiting for its day, soonest first (#388); the last is the latest published. */
  readonly waiting: readonly SopVersion[];
  /** The signed-in staff member's role is one the version in force asks. */
  readonly mustAcknowledge: boolean;
  /** When they acknowledged the version in force; null if they have not. */
  readonly acknowledgedAt: string | null;
  /** Of the venue's active staff in the roles it asks, how many have acknowledged it, and how many it asks. */
  readonly acknowledgedCount: number;
  readonly requiredCount: number;
}

/** One staff member a version asks to acknowledge it, for SOP managers. */
export interface SopAcknowledgement {
  readonly staffId: string;
  readonly fullName: string;
  readonly role: StaffRole;
  readonly acknowledgedAt: string | null;
}

/** A version as the console publishes it; a new SOP adds its title. */
export interface SopVersionInput {
  readonly owner: string;
  readonly ackRoles: readonly StaffRole[];
  readonly effectiveOn: string;
  readonly body: string;
}

/**
 * Why an SOP step did not go through: `day` a day before today or the last version's; `taken` a title
 * the library has; `changed` a version acknowledged just after a newer one came into force.
 */
export type SopFailure = 'not_allowed' | 'paused' | 'day' | 'taken' | 'changed' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, SopFailure>> = {
  '42501': 'not_allowed', RVFRZ: 'paused', '22023': 'day', '23505': 'taken', RVSTL: 'changed',
};

type LibraryRow = Database['public']['Functions']['sop_library']['Returns'][number];

/** The versions waiting for their day; none when the row cannot be read. */
function waitingOf(waiting: unknown): SopVersion[] {
  const parsed = sopWaitingSchema.safeParse(waiting);
  return parsed.success ? parsed.data.map((version) => ({
    versionId: version.version_id, version: version.version, owner: version.owner, ackRoles: version.ack_roles,
    effectiveOn: version.effective_on, body: version.body,
  })) : [];
}

/** One SOP from the library's row: its version in force, or null before its first day, and every version waiting. */
function toSop(row: LibraryRow): Sop {
  return {
    sopId: row.sop_id, title: row.title,
    current: row.version_id
      ? { versionId: row.version_id, version: row.version, owner: row.owner, ackRoles: row.ack_roles, effectiveOn: row.effective_on, body: row.body }
      : null,
    waiting: waitingOf(row.waiting),
    mustAcknowledge: row.must_acknowledge, acknowledgedAt: row.acknowledged_at,
    acknowledgedCount: row.acknowledged_count, requiredCount: row.required_count,
  };
}

/** The venue's SOP library, by title, for its staff. */
export function useSopLibrary(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.sops(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Sop[]> => {
      const { data, error } = await client.rpc('sop_library', { p_venue_id: venueId });
      if (error) throw error;
      return data.map(toSop);
    },
  });
}

/** For SOP managers: the staff a version asks, those yet to acknowledge it first. */
export function useSopAcknowledgements(versionId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.sopAcknowledgements(userId ?? 'signed-out', versionId),
    enabled: userId !== null,
    queryFn: async (): Promise<SopAcknowledgement[]> => {
      const { data, error } = await client.rpc('sop_acknowledgements', { p_version_id: versionId });
      if (error) throw error;
      return data.map((row) => ({ staffId: row.staff_id, fullName: row.full_name, role: row.role, acknowledgedAt: row.acknowledged_at }));
    },
  });
}

/**
 * What staff do with SOPs: `acknowledge` the version in force; for SOP managers, `publish` a new version
 * of one and `add` a new SOP. Each resolves to a Result and reloads the library and its acknowledgements.
 */
export function useSopActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <T>(value: T, error: { code: string } | null): Promise<Result<T, SopFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.sops(userId ?? 'signed-out', venueId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.sopAcknowledgementsAll(userId ?? 'signed-out') });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
  const toArgs = (input: SopVersionInput) => ({
    p_owner: input.owner, p_ack_roles: [...input.ackRoles], p_effective_on: input.effectiveOn, p_body: input.body,
  });
  const acknowledge = useMutation({
    mutationFn: async (versionId: string) => {
      const { error } = await client.rpc('acknowledge_sop', { p_version_id: versionId });
      return settle(null, error);
    },
  });
  const publish = useMutation({
    mutationFn: async ({ sopId, ...input }: SopVersionInput & { sopId: string }) => {
      const { data, error } = await client.rpc('publish_sop_version', { p_sop_id: sopId, ...toArgs(input) });
      return settle(data, error);
    },
  });
  const add = useMutation({
    mutationFn: async ({ title, ...input }: SopVersionInput & { title: string }) => {
      const { data, error } = await client.rpc('add_sop', { p_venue_id: venueId, p_title: title, ...toArgs(input) });
      return settle(data, error);
    },
  });
  return { acknowledge, publish, add };
}
