import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { shrinkPhoto } from './photo.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// The public bucket of menu photos (supabase/migrations/20261102030100_item_photos.sql): JPEGs of up to 1 MB.
const BUCKET = 'item-photos';
const MAX_BYTES = 1_048_576;

/** The public address of an item's photo, or null when it has none (AS-11). */
export function itemPhotoUrl(client: RivrClient, path: string | null): string | null {
  return path === null ? null : client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Why a photo did not go on: not a photo the browser can read, still over 1 MB once made small, the role, or anything else. */
export type ItemPhotoFailure = 'not_a_photo' | 'too_big' | 'not_allowed' | 'unavailable';

/** The photo to put on a menu item: its id, and the file staff chose. */
export interface ItemPhotoOrder {
  readonly itemId: string;
  readonly photo: Blob;
}

/**
 * Puts a photo on a menu item (fnb.manage), AS-11: made a JPEG of at most 1024 px, as a KYC
 * photo is, it goes up under a name of its own, then the database makes it the item's photo; the item's lists reload.
 */
export function useItemPhotoUpload(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, photo }: ItemPhotoOrder): Promise<Result<null, ItemPhotoFailure>> => {
      const jpeg = await shrinkPhoto(photo).catch(() => null);
      if (jpeg === null) return err('not_a_photo');
      if (jpeg.size > MAX_BYTES) return err('too_big');
      const path = `${venueId}/menu-${crypto.randomUUID()}.jpg`;
      const upload = await client.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg' });
      if (upload.error) return err('unavailable');
      const { error } = await client.rpc('set_item_photo', { p_kind: 'menu', p_item_id: itemId, p_path: path });
      await queryClient.invalidateQueries({ queryKey: queryKeys.fnbItems(userId ?? 'signed-out', venueId) });
      if (error) return err(error.code === '42501' ? 'not_allowed' : 'unavailable');
      return ok(null);
    },
  });
}
