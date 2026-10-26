import { useQuery } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** How long a KYC image link works, fixed by the kyc-image-url Edge Function. */
export const KYC_IMAGE_URL_SECONDS = 60;

/** The Storage API's address as this client reaches it: `https://<ref>.supabase.co/storage/v1`. */
function storageApiUrl(client: RivrClient): string {
  const { publicUrl } = client.storage.from('kyc').getPublicUrl('').data;
  return publicUrl.slice(0, publicUrl.indexOf('/object/public/'));
}

/**
 * A signed URL for one KYC image (`<venue_id>/<member_id>/<file>` in the private `kyc` bucket),
 * valid for a minute. The kyc-image-url Edge Function signs it for active staff with KYC review
 * or the cage at that venue, and audits the view; anyone else gets an error.
 */
export async function signedKycImageUrl(client: RivrClient, path: string): Promise<string> {
  const { data, error } = await client.functions.invoke('kyc-image-url', { body: { path } });
  if (error) throw error;
  const signedPath: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'signedPath') : undefined;
  if (typeof signedPath !== 'string') throw new Error('kyc-image-url answered without a signed path');
  return `${storageApiUrl(client)}${signedPath}`;
}

/** One KYC image's signed URL, kept fresh: the one way any app shows a KYC image. */
export function useKycImageUrl(path: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycImageUrl(userId ?? 'signed-out', path ?? ''),
    enabled: userId !== null && path !== null,
    // Ask for a fresh link before this one runs out.
    staleTime: (KYC_IMAGE_URL_SECONDS - 10) * 1000,
    // A refusal stays a refusal; the screen's error state offers Try again.
    retry: false,
    queryFn: () => signedKycImageUrl(client, path ?? ''),
  });
}
