import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/cctv), off the player's first load.
const keys = {
  cameras: (userId: string, venueId: string) => ['user', userId, 'cameras', venueId] as const,
  playback: (userId: string, kind: string, id: string) => ['user', userId, 'playback', kind, id] as const,
};

/** A CCTV camera (#122): its recorder channel, and the table or cage it watches, if any. */
export interface Camera {
  readonly cameraId: string;
  readonly name: string;
  readonly channel: string;
  readonly tableId: string | null;
  readonly tableName: string | null;
  readonly isCage: boolean;
  readonly isActive: boolean;
}

/** A camera as it is added or changed: over a table, on the cage, or neither. */
export interface CameraChange {
  readonly cameraId: string | null;
  readonly name: string;
  readonly channel: string;
  readonly tableId: string | null;
  readonly isCage: boolean;
  readonly isActive: boolean;
}

/** Why a camera was not saved: `taken` is a name, table or cage that already has an active camera. */
export type CameraFailure = 'not_allowed' | 'invalid' | 'taken' | 'paused' | 'unavailable';

/** What a playback link is for: a hand, a cage transaction or an incident. */
export type CctvKind = 'hand' | 'cage_transaction' | 'incident';

/** Why there is no playback link: no camera saw it, or the caller may not see it. */
export type PlaybackFailure = 'no_camera' | 'not_allowed' | 'unavailable';

const CAMERA_FAILURES: Readonly<Record<string, CameraFailure>> = { '42501': 'not_allowed', '22023': 'invalid', '23505': 'taken', RVFRZ: 'paused' };

/** The venue's cameras, active first, for any of its staff. */
export function useCameras(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.cameras(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Camera[]> => {
      const { data, error } = await client.rpc('cameras', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        cameraId: row.camera_id, name: row.name, channel: row.channel, tableId: row.table_id, tableName: row.table_name,
        isCage: row.is_cage, isActive: row.is_active,
      }));
    },
  });
}

/** Adds, changes or retires a camera (devices.manage), a Result; the cameras reload. */
export function useSaveCamera(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (camera: CameraChange): Promise<Result<string, CameraFailure>> => {
      const { data, error } = await client.rpc('save_camera', {
        p_venue_id: venueId, p_name: camera.name, p_channel: camera.channel, p_is_cage: camera.isCage, p_is_active: camera.isActive,
        ...(camera.cameraId === null ? {} : { p_camera_id: camera.cameraId }), ...(camera.tableId === null ? {} : { p_table_id: camera.tableId }),
      });
      if (error) return err(CAMERA_FAILURES[error.code] ?? 'unavailable');
      await queryClient.invalidateQueries({ queryKey: keys.cameras(userId ?? 'signed-out', venueId) });
      return ok(data);
    },
  });
}

/** The HTTP status an Edge Function answered with, from supabase-js's error; 0 when it did not answer. */
function statusOf(error: unknown): number {
  const response: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'context') : undefined;
  return response instanceof Response ? response.status : 0;
}

/** Where a recording's playback link is, as @rivr/ui's PlaybackLink shows it. */
export type PlaybackState =
  | { readonly status: 'idle' }
  | { readonly status: 'asking' }
  | { readonly status: 'ready'; readonly url: string; readonly camera: string }
  | { readonly status: 'failed'; readonly reason: PlaybackFailure };

/**
 * The recorder's playback link for the camera that saw a hand, cage transaction or incident (#122), through the
 * cctv-playback Edge Function: its state, and `ask` to ask for it (a press of Playback). A link is kept while the
 * screen is open; one that did not come is asked again on the next press.
 */
export function usePlayback(kind: CctvKind, id: string): { state: PlaybackState; ask: () => void } {
  const link = usePlaybackLink(kind, id);
  const state: PlaybackState = link.isFetching ? { status: 'asking' }
    : link.data?.ok ? { status: 'ready', ...link.data.value }
    : link.data !== undefined ? { status: 'failed', reason: link.data.error }
    : link.isError ? { status: 'failed', reason: 'unavailable' } : { status: 'idle' };
  return { state, ask: () => void link.refetch() };
}

function usePlaybackLink(kind: CctvKind, id: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.playback(userId ?? 'signed-out', kind, id),
    enabled: false,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<Result<{ url: string; camera: string }, PlaybackFailure>> => {
      const { data, error } = await client.functions.invoke('cctv-playback', { body: { kind, id } });
      if (error) {
        const status = statusOf(error);
        return err(status === 404 ? 'no_camera' : status === 403 ? 'not_allowed' : 'unavailable');
      }
      const url: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'url') : undefined;
      const camera: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'camera') : undefined;
      return typeof url === 'string' && typeof camera === 'string' ? ok({ url, camera }) : err('unavailable');
    },
  });
}
