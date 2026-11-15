import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { LIST_MOST } from './limits.ts';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/cctv), off the player's first load.
const keys = {
  cameras: (userId: string, venueId: string) => ['user', userId, 'cameras', venueId] as const,
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

const CAMERA_FAILURES: Readonly<Record<string, CameraFailure>> = { '42501': 'not_allowed', '22023': 'invalid', '23505': 'taken', RVFRZ: 'paused' };

/** The venue's cameras, active first, for any of its staff. */
export function useCameras(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.cameras(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<Camera[]> => {
      const { data, error } = await client.rpc('cameras', { p_venue_id: venueId }).limit(LIST_MOST);
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
