import { t } from '@rivr/i18n';
import { useState } from 'react';
import { Text } from '../Text/Text.tsx';

export interface VenueLogoProps {
  /** What it shows, read out: "The venue's logo". */
  alt: string;
  /** The logo's address, or null when the venue has none yet. */
  src: string | null;
}

/**
 * The venue's logo as Settings shows it (#397): whole, in a fixed 4:3 box, on the raised surface. Says so
 * in words when there is no logo yet, or when it could not load.
 */
export function VenueLogo({ alt, src }: VenueLogoProps) {
  // The address that failed to load, so a new logo is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isFailed = src !== null && src === failedSrc;
  return (
    <div className="flex aspect-photo w-photo shrink-0 items-center justify-center overflow-hidden rounded-md border border-hairline bg-raised p-3">
      {src !== null && !isFailed ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" onError={() => setFailedSrc(src)} />
      ) : (
        <Text variant="small" tone="muted" align="center">
          {isFailed ? t('ui.logo.failed') : t('ui.logo.missing')}
        </Text>
      )}
    </div>
  );
}
