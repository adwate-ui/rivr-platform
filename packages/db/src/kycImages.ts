import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** How long a KYC image link works: long enough to load the photo, too short to pass around. */
export const KYC_IMAGE_URL_SECONDS = 60;

/**
 * A signed URL for one KYC image (`<venue_id>/<member_id>/<file>` in the private `kyc` bucket),
 * valid for a minute. Storage mints it only for active staff with KYC review or the cage at that
 * venue; anyone else gets an error. The one way any app shows a KYC image.
 */
export function useKycImageUrl(path: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycImageUrl(userId ?? 'signed-out', path ?? ''),
    enabled: path !== null,
    // Ask for a fresh link before this one runs out.
    staleTime: (KYC_IMAGE_URL_SECONDS - 10) * 1000,
    // A refusal stays a refusal; the screen's error state offers Try again.
    retry: false,
    queryFn: async () => {
      const { data, error } = await client.storage.from('kyc').createSignedUrl(path ?? '', KYC_IMAGE_URL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
