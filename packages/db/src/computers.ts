import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COMPUTER_TOKEN_KEY } from './client.ts';
import { toThisComputer } from './parse/thisComputer.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** What a computer is enrolled as (#384): the cage, or an admin console. */
export type ComputerKind = 'cage' | 'console';

/** One of the venue's cage and admin computers: enrolled, or added and waiting for its code. */
export interface Computer {
  readonly deviceId: string;
  readonly kind: ComputerKind;
  readonly name: string;
  readonly isEnrolled: boolean;
}

/**
 * This browser at the venue: the computer it is enrolled as, if any; whether the venue enforces cage
 * and admin computers (it has their networks); and whether this browser is on those networks.
 */
export interface ThisComputer {
  readonly computer: Omit<Computer, 'isEnrolled'> | null;
  readonly isEnforced: boolean;
  readonly isOnStaffNetwork: boolean;
}

/** A computer's code, to enter on that computer, and when it stops working. */
export interface ComputerCode {
  readonly deviceId: string;
  readonly code: string;
  readonly expiresAt: string;
}

/**
 * Why adding or enrolling a computer did not go through: not allowed (a device manager at an admin
 * console adds; staff on the venue's networks enrol), the venue frozen, no name, a wrong, used or expired
 * code, too many wrong codes (wait ten minutes), or anything else.
 */
export type ComputerFailure = 'not_allowed' | 'paused' | 'invalid' | 'wrong_code' | 'too_many' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, ComputerFailure>> = {
  '42501': 'not_allowed', RVFRZ: 'paused', '23514': 'invalid', '22023': 'invalid', RVMAX: 'too_many',
};

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** The venue's cage and admin computers that are not revoked, by name. */
export function useComputers(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.computers(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Computer[]> => {
      const { data, error } = await client.from('device').select('id, kind, name, token_hash')
        .eq('venue_id', venueId).in('kind', ['cage', 'console']).is('revoked_at', null).order('name');
      if (error) throw error;
      return data.map((row) => ({ deviceId: row.id, kind: row.kind === 'cage' ? 'cage' : 'console', name: row.name, isEnrolled: row.token_hash !== null }));
    },
  });
}

/** This browser at the venue, as the database sees the token it sends. */
export function useThisComputer(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.thisComputer(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<ThisComputer> => {
      const { data, error } = await client.rpc('this_computer', { p_venue_id: venueId });
      if (error) throw error;
      return toThisComputer(data[0]);
    },
  });
}

/**
 * `add` a computer (devices.manage, at an admin console once the venue enforces): the cage or an admin
 * console, by name, giving its ten-minute code. `enrol` this browser with a code: it makes a secret
 * token and keeps it, and the database stores only its SHA-256 hash. Revoking is useDeviceActions'.
 */
export function useComputerActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.computers(userId ?? 'signed-out', venueId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.thisComputer(userId ?? 'signed-out', venueId) });
  };
  const add = useMutation({
    mutationFn: async ({ kind, name }: { kind: ComputerKind; name: string }): Promise<Result<ComputerCode, ComputerFailure>> => {
      const { data, error } = await client.rpc('add_computer', { p_venue_id: venueId, p_kind: kind, p_name: name.trim() });
      await reload();
      const row = data?.[0];
      if (error || !row) return err(FAILURE_BY_CODE[error?.code ?? ''] ?? 'unavailable');
      return ok({ deviceId: row.device_id, code: row.code, expiresAt: row.expires_at });
    },
  });
  const enrol = useMutation({
    mutationFn: async (code: string): Promise<Result<string, ComputerFailure>> => {
      const token = hex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
      const hash = hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
      const { data, error } = await client.rpc('claim_computer', { p_venue_id: venueId, p_code: code.trim(), p_token_hash: hash });
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      // The database names no device for a wrong, used or expired code.
      if (!data) return err('wrong_code');
      globalThis.localStorage.setItem(COMPUTER_TOKEN_KEY, token);
      await reload();
      return ok(data);
    },
  });
  return { add, enrol };
}
