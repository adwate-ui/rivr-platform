import { t } from '@rivr/i18n';
import { useState } from 'react';
import { Text } from '../Text/Text.tsx';

export interface KycPhotoProps {
  /** What it shows, read out: "KYC photo of Kabir Sethi". */
  alt: string;
  /** The image's address; null while it loads or when there is none (see `status`). */
  src: string | null;
  /** `loading` while its address is fetched, `missing` when there is no photo, `error` when it could not be had. */
  status?: 'ready' | 'loading' | 'missing' | 'error';
}

/** A photo's state from its stored path and the fetch of its address: none kept, could not be had, shown, or still loading. */
export function kycPhotoStatus(path: string | null, address: { isError: boolean; data?: string | null | undefined }): NonNullable<KycPhotoProps['status']> {
  if (path === null) return 'missing';
  if (address.isError) return 'error';
  return address.data ? 'ready' : 'loading';
}

/**
 * A member's KYC photo at a fixed portrait size beside their details: in the review queue, and at the
 * cage (A-003). Shows in words when it is loading, missing or could not load.
 */
export function KycPhoto({ alt, src, status = 'ready' }: KycPhotoProps) {
  // The address that failed to load, so a new address is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isFailed = status === 'error' || (src !== null && src === failedSrc);
  const isShown = status === 'ready' && src !== null && !isFailed;
  const words = status === 'loading' ? t('common.loading') : isFailed ? t('ui.photo.failed') : t('ui.photo.missing');
  return (
    <div className="flex aspect-portrait w-photo shrink-0 items-center justify-center overflow-hidden rounded-md border border-hairline bg-raised">
      {isShown ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        <div className="px-3">
          <Text variant="small" tone="muted" align="center">
            {words}
          </Text>
        </div>
      )}
    </div>
  );
}
