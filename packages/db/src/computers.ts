import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { COMPUTER_TOKEN_KEY } from './client.ts';
import { toThisComputer } from './parse/thisComputer.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** What a computer is enrolled as (#384): the cage, or an admin console. */
export type ComputerKind = 'cage' | 'console';

/** One of the venue's enrolled cage and admin computers. */
export interface Computer {
  readonly deviceId: string;
  readonly kind: ComputerKind;
  readonly name: string;
}

/**
 * This browser at the venue: the computer it is enrolled as, if any; whether the venue enforces cage
 * and admin computers (it has their networks); and whether this browser is on those networks.
 */
export interface ThisComputer {
  readonly computer: Computer | null;
  readonly isEnforced: boolean;
  readonly isOnStaffNetwork: boolean;
}

/** Why an enrolment did not go through: not a device manager here, the venue frozen, no name, or anything else. */
export type ComputerFailure = 'not_allowed' | 'paused' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, ComputerFailure>> = { '42501': 'not_allowed', RVFRZ: 'paused', '23514': 'invalid' };

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/** The venue's enrolled cage and admin computers that are not revoked, by name. */
export function useComputers(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.computers(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Computer[]> => {
      const { data, error } = await client.from('device').select('id, kind, name')
        .eq('venue_id', venueId).in('kind', ['cage', 'console']).not('token_hash', 'is', null).is('revoked_at', null).order('name');
      if (error) throw error;
      return data.map((row) => ({ deviceId: row.id, kind: row.kind === 'cage' ? 'cage' : 'console', name: row.name }));
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
 * Enrols this browser as the cage or an admin console (devices.manage): it makes a secret token and
 * keeps it; the database stores only its SHA-256 hash. Revoking is useDeviceActions' revoke.
 */
export function useEnrolComputer(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, name }: { kind: ComputerKind; name: string }): Promise<Result<string, ComputerFailure>> => {
      const token = hex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
      const hash = hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
      const { data, error } = await client.from('device')
        .insert({ venue_id: venueId, kind, name: name.trim(), token_hash: hash }).select('id').single();
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      globalThis.localStorage.setItem(COMPUTER_TOKEN_KEY, token);
      await queryClient.invalidateQueries({ queryKey: queryKeys.computers(userId ?? 'signed-out', venueId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.thisComputer(userId ?? 'signed-out', venueId) });
      return ok(data.id);
    },
  });
}
