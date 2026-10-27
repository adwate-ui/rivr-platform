import type { TvMode } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import type { RivrClient } from './client.ts';
import { toDeviceSession, type DeviceSession } from './parse/deviceSession.ts';
import { functionErrorCode } from './parse/kycFailure.ts';
import { toTvCode, type TvCode } from './parse/tvCode.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

export type { TvCode };

/** What an unpaired TV shows (#49): its code, or why it has none (`too_many` while device-pair refuses for a while). */
export type TvPairing = { status: 'loading' } | { status: 'code'; code: TvCode } | { status: 'too_many' } | { status: 'unavailable' };

/** The signed-in TV: its name on the console, what it shows, and the boards it turns to after that (decision 0163). */
export interface MyTvScreen {
  readonly deviceId: string;
  readonly venueId: string;
  readonly name: string;
  readonly mode: TvMode;
  readonly rotation: readonly TvMode[];
}

/** One of a venue's TVs, as staff who manage devices see it. */
export interface VenueTv {
  readonly deviceId: string;
  readonly name: string;
  /** The TV has picked up its login. */
  readonly isPaired: boolean;
  readonly mode: TvMode | null;
  /** The boards it turns to after its main one, in order. */
  readonly rotation: readonly TvMode[];
}

/** Why a staff action on a TV did not go through: `wrong_code` is no TV showing it, `paused` the venue frozen. */
export type TvFailure = 'wrong_code' | 'not_allowed' | 'paused' | 'invalid' | 'unavailable';

const TV_FAILURE_BY_CODE: Readonly<Record<string, TvFailure>> = { RVCOD: 'wrong_code', '42501': 'not_allowed', RVFRZ: 'paused', '22023': 'invalid' };

// An unpaired TV asks every three seconds whether its code has been typed in. A request for a code
// that was refused or failed is made again after a minute.
const CLAIM_CHECK = 3_000;
const ASK_AGAIN = 60_000;
// A paired TV, and the console's list, ask again every ten seconds, so a mode changed or a TV
// unpaired on the console reaches the TV without a reload.
const SCREEN_CHECK = 10_000;

/** device-pair's answer to a TV asking with its secret: the TV's session once its code is claimed, else null (after `onExpired` once the secret is no longer good). */
async function askWithSecret(client: RivrClient, secret: string, onExpired: () => void): Promise<DeviceSession | null> {
  const { data, error } = await client.functions.invoke('device-pair', { body: { tv: 'check', secret } });
  if (!error) return toDeviceSession(data);
  if ((await functionErrorCode(error)) === 'expired') onExpired();
  return null;
}

/** Asks device-pair whether the code was typed in: signs the TV in once it was; a new code once this one is no longer good. */
function useClaimCheck(code: TvCode | null, onExpired: () => void) {
  const { client } = useRivrData();
  // device-pair hands a code's session over once, so a session the TV could not keep (a dropped
  // connection, say) is held here and tried again rather than asked for again.
  const pending = useRef<DeviceSession | null>(null);
  useQuery({
    queryKey: queryKeys.tvClaim(code?.code ?? 'none'),
    enabled: code !== null,
    gcTime: 0,
    refetchInterval: CLAIM_CHECK,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<'waiting' | 'paired'> => {
      const session = pending.current ?? (code === null ? null : await askWithSecret(client, code.secret, onExpired));
      if (session === null) return 'waiting';
      pending.current = session;
      if ((await client.auth.setSession(session)).error) return 'waiting';
      pending.current = null;
      return 'paired';
    },
  });
}

/**
 * An unpaired TV's code: asked for from device-pair while no one is signed in, and again once it has
 * run out. Once staff type it into the console, the TV signs in as itself and the app shows its screen.
 */
export function useTvPairing(): TvPairing {
  const { client, authStatus } = useRivrData();
  const request = useQuery({
    queryKey: queryKeys.tvCode(),
    enabled: authStatus === 'signed-out',
    gcTime: 0,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    // A code is renewed when device-pair says it has run out (useClaimCheck), not by the TV's own
    // clock, which may be wrong.
    refetchInterval: (query) => (query.state.data?.ok ? false : ASK_AGAIN),
    queryFn: async (): Promise<Result<TvCode, 'too_many' | 'unavailable'>> => {
      const { data, error } = await client.functions.invoke('device-pair', { body: { tv: 'start' } });
      if (error) return err((await functionErrorCode(error)) === 'too_many' ? 'too_many' : 'unavailable');
      const code = toTvCode(data);
      return code === null ? err('unavailable') : ok(code);
    },
  });
  // Every ask with the old secret says it ran out until the new code arrives: one request for it at a time.
  useClaimCheck(request.data?.ok ? request.data.value : null, () => void request.refetch({ cancelRefetch: false }));
  if (request.data === undefined) return { status: 'loading' };
  return request.data.ok ? { status: 'code', code: request.data.value } : { status: request.data.error };
}

/**
 * The signed-in TV's name and mode. A session that is not a TV's, or a TV's since unpaired, reads
 * nothing: it is signed out here, and the TV shows a new code.
 */
export function useMyTvScreen() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myTvScreen(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: SCREEN_CHECK,
    queryFn: async (): Promise<MyTvScreen | null> => {
      const { data, error } = await client.rpc('my_tv_screen');
      if (error) throw error;
      const row = data[0];
      if (row === undefined) {
        await client.auth.signOut({ scope: 'local' });
        return null;
      }
      return { deviceId: row.device_id, venueId: row.venue_id, name: row.name, mode: row.mode, rotation: row.rotation };
    },
  });
}

/**
 * Whether `venueId` is a venue the public may see (`public_venue` leaves out the practice venue, which
 * never reaches anyone outside the club): the stream overlay shows nothing at the practice venue (#125).
 * Undefined until it is read.
 */
export function useIsPublicVenue(venueId: string | undefined): boolean | undefined {
  const { client, userId } = useRivrData();
  const venue = useQuery({
    queryKey: queryKeys.isPublicVenue(userId ?? 'signed-out', venueId ?? 'none'),
    enabled: userId !== null && venueId !== undefined,
    queryFn: async () => {
      const { data, error } = await client.from('public_venue').select('id').eq('id', venueId ?? '');
      if (error) throw error;
      return data.length > 0;
    },
  });
  return venue.data;
}

/** The venue's TVs that are not unpaired, by name, with what each shows. */
export function useVenueTvs(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueTvs(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: SCREEN_CHECK,
    queryFn: async (): Promise<VenueTv[]> => {
      const [devices, screens] = await Promise.all([
        client.from('device').select('id, name, auth_user_id').eq('venue_id', venueId).eq('kind', 'tv').is('revoked_at', null).order('name'),
        client.from('tv_screen').select('device_id, mode, rotation').eq('venue_id', venueId),
      ]);
      if (devices.error) throw devices.error;
      if (screens.error) throw screens.error;
      const screenOf = new Map(screens.data.map((row) => [row.device_id, row]));
      return devices.data.map((device) => ({
        deviceId: device.id, name: device.name, isPaired: device.auth_user_id !== null, mode: screenOf.get(device.id)?.mode ?? null,
        rotation: screenOf.get(device.id)?.rotation ?? [],
      }));
    },
  });
}

/**
 * What staff with devices.manage do with TVs: `pair` one by the code it shows, with a name and mode
 * (ok with its device id); change what one shows (`setMode`) and the boards it turns to after that (`setRotation`, decision
 * 0163); `unpair` one, with the reason. Each
 * resolves to a Result and reloads the list.
 */
export function useTvActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <T>(value: T, error: { code: string } | null): Promise<Result<T, TvFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.venueTvs(userId ?? 'signed-out', venueId) });
    return error ? err(TV_FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
  const pair = useMutation({
    mutationFn: async ({ code, name, mode }: { code: string; name: string; mode: TvMode }) => {
      const { data, error } = await client.rpc('claim_tv_pairing', { p_venue_id: venueId, p_code: code, p_name: name.trim(), p_mode: mode });
      return settle(data ?? '', error);
    },
  });
  const setMode = useMutation({
    mutationFn: async ({ deviceId, mode }: { deviceId: string; mode: TvMode }) =>
      settle(null, (await client.rpc('set_tv_mode', { p_device_id: deviceId, p_mode: mode })).error),
  });
  const setRotation = useMutation({
    mutationFn: async ({ deviceId, rotation }: { deviceId: string; rotation: readonly TvMode[] }) =>
      settle(null, (await client.rpc('set_tv_rotation', { p_device_id: deviceId, p_rotation: [...rotation] })).error),
  });
  const unpair = useMutation({
    // As a tablet is revoked (#41): the database unlinks the TV's login, and 'now' is the database's time.
    mutationFn: async ({ deviceId, reason }: { deviceId: string; reason: string }) =>
      settle(null, (await client.from('device').update({ revoked_at: 'now', revoked_reason: reason.trim() }).eq('id', deviceId)).error),
  });
  return { pair, setMode, setRotation, unpair };
}
