import { deviceSessionSchema } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { functionErrorCode } from './parse/kycFailure.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The signed-in dealer tablet (#41): its name, and the table it is fixed to, if any. */
export interface MyDevice {
  readonly deviceId: string;
  readonly venueId: string;
  readonly name: string;
  readonly tableId: string | null;
  readonly tableName: string | null;
}

/** One of a venue's dealer tablets, as staff who manage devices see it. */
export interface DealerTablet {
  readonly deviceId: string;
  readonly name: string;
  /** The tablet has signed in with a pairing code. */
  readonly isPaired: boolean;
  readonly tableId: string | null;
}

/** A pairing code to read out to a tablet, and when it stops working. */
export interface PairingCode {
  readonly deviceId: string;
  readonly code: string;
  readonly expiresAt: string;
}

/**
 * Why pairing did not go through: a code that is wrong, used or expired; too many wrong codes from
 * here (wait ten minutes); or anything else.
 */
export type PairFailure = 'wrong_code' | 'too_many' | 'unavailable';

/** Why a staff action on a tablet did not go through: `paused` is the venue frozen. */
export type DeviceFailure = 'not_allowed' | 'paused' | 'invalid' | 'unavailable';

const DEVICE_FAILURE_BY_CODE: Readonly<Record<string, DeviceFailure>> = { '42501': 'not_allowed', RVFRZ: 'paused', '22023': 'invalid' };

// The tablet asks again every half minute, so a table fixed on the console reaches it without a restart.
const TABLE_CHECK = 30_000;

/** The signed-in device; null for anyone who is not one, or a device since revoked. */
export function useMyDevice() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myDevice(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: TABLE_CHECK,
    queryFn: async (): Promise<MyDevice | null> => {
      const { data, error } = await client.rpc('my_device');
      if (error) throw error;
      const row = data[0];
      return row ? { deviceId: row.device_id, venueId: row.venue_id, name: row.name, tableId: row.table_id, tableName: row.table_name } : null;
    },
  });
}

/**
 * Pairs this tablet with the code staff read out (device-pair): the tablet signs in as itself and
 * keeps the session. Any session left from before is dropped first.
 */
export function usePairDevice() {
  const { client } = useRivrData();
  return useMutation({
    mutationFn: async (code: string): Promise<Result<null, PairFailure>> => {
      await client.auth.signOut({ scope: 'local' });
      const { data, error } = await client.functions.invoke('device-pair', { body: { code } });
      if (error) {
        const refusal = await functionErrorCode(error);
        if (refusal === 'too_many') return err('too_many');
        return err(refusal === 'wrong_code' || refusal === 'invalid' ? 'wrong_code' : 'unavailable');
      }
      const session = deviceSessionSchema.safeParse(data);
      if (!session.success) return err('unavailable');
      const { error: refused } = await client.auth.setSession(session.data);
      return refused ? err('unavailable') : ok(null);
    },
  });
}

/** The venue's dealer tablets that are not revoked, by name, with the table each is fixed to. */
export function useDealerTablets(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.dealerTablets(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<DealerTablet[]> => {
      const [devices, assignments] = await Promise.all([
        client.from('device').select('id, name, auth_user_id').eq('venue_id', venueId).eq('kind', 'dealer_tablet').is('revoked_at', null).order('name'),
        client.from('tablet_assignment').select('device_id, table_id').eq('venue_id', venueId),
      ]);
      if (devices.error) throw devices.error;
      if (assignments.error) throw assignments.error;
      const tableOf = new Map(assignments.data.map((row) => [row.device_id, row.table_id]));
      return devices.data.map((device) => ({
        deviceId: device.id, name: device.name, isPaired: device.auth_user_id !== null, tableId: tableOf.get(device.id) ?? null,
      }));
    },
  });
}

/**
 * What staff with devices.manage do with dealer tablets: `add` one, which also starts pairing it (ok
 * with no code when it was added but pairing did not start: New pairing code pairs it); `pair` one
 * again; fix one to a table (`assign`); `revoke` a lost one, with the reason. The database records who
 * added it. Each resolves to a Result and reloads the list.
 */
export function useDeviceActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <T>(value: T, error: { code: string } | null): Promise<Result<T, DeviceFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.dealerTablets(userId ?? 'signed-out', venueId) });
    return error ? err(DEVICE_FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
  const startPairing = async (deviceId: string) => {
    const { data, error } = await client.rpc('start_device_pairing', { p_device_id: deviceId });
    const row = data?.[0];
    return settle<PairingCode | null>(row ? { deviceId, code: row.code, expiresAt: row.expires_at } : null, error);
  };
  const add = useMutation({
    mutationFn: async ({ name }: { name: string }): Promise<Result<PairingCode | null, DeviceFailure>> => {
      const { data, error } = await client.from('device').insert({ venue_id: venueId, kind: 'dealer_tablet', name: name.trim() }).select('id').single();
      if (error || !data) return settle<PairingCode | null>(null, error);
      const paired = await startPairing(data.id);
      return paired.ok ? paired : ok(null);
    },
  });
  const pair = useMutation({ mutationFn: startPairing });
  const assign = useMutation({
    mutationFn: async ({ deviceId, tableId }: { deviceId: string; tableId: string }) =>
      settle(null, (await client.rpc('assign_tablet', { p_device_id: deviceId, p_table_id: tableId })).error),
  });
  const revoke = useMutation({
    // Postgres reads 'now' as the time of the change, so the console's clock does not matter.
    mutationFn: async ({ deviceId, reason }: { deviceId: string; reason: string }) =>
      settle(null, (await client.from('device').update({ revoked_at: 'now', revoked_reason: reason.trim() }).eq('id', deviceId)).error),
  });
  return { add, pair, assign, revoke };
}
