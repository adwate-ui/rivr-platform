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
  /**
   * Filling its frame, as on the membership card, whose frame is its only border: the photo covers it, and in its place the
   * member's `initial` (the state read out in words); otherwise the fixed size beside details, saying its state in words.
   */
  isFilling?: boolean;
  /** The member's initial, shown in a filling frame when there is no photo to show (8 Nov audit, F-205). */
  initial?: string | undefined;
}

/** Its state in words: loading, could not load, or none kept. */
function wordsOf(status: KycPhotoProps['status'], isFailed: boolean): string {
  if (status === 'loading') return t('common.loading');
  return isFailed ? t('ui.photo.failed') : t('ui.photo.missing');
}

/** Filling its frame: the photo covering it, or the initial named in words where there is none to show (F-201, F-205). */
function FillingPhoto({ alt, src, words, initial, onFailed }: {
  alt: string; src: string | null; words: string; initial: string | undefined; onFailed: (src: string) => void;
}) {
  return (
    <div className="flex size-full items-center justify-center bg-raised">
      {src === null ? (
        <span role="img" aria-label={words} className="font-display text-28 text-content-muted">{initial}</span>
      ) : (
        <img src={src} alt={alt} className="size-full object-cover" onError={() => onFailed(src)} />
      )}
    </div>
  );
}

/** A photo's state from its stored path and the fetch of its address: none kept, could not be had, shown, or still loading. */
export function kycPhotoStatus(path: string | null, address: { isError: boolean; data?: string | null | undefined }): NonNullable<KycPhotoProps['status']> {
  if (path === null) return 'missing';
  if (address.isError) return 'error';
  return address.data ? 'ready' : 'loading';
}

/**
 * A member's KYC photo at a fixed portrait size beside their details: in the review queue, and at the
 * cage (A-003); or, `isFilling`, covering the frame it is put in, as on the membership card (decision 0300), with no
 * border of its own and no side left showing the frame's colour (F-201). Shows in words when it is loading, missing or
 * could not load; filling, the member's initial in their place, with the words as its name, as a frame that small cannot
 * hold a sentence (F-205).
 */
export function KycPhoto({ alt, src, status = 'ready', isFilling, initial }: KycPhotoProps) {
  // The address that failed to load, so a new address is tried again.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isFailed = status === 'error' || (src !== null && src === failedSrc);
  const isShown = status === 'ready' && src !== null && !isFailed;
  const words = wordsOf(status, isFailed);
  if (isFilling === true) return <FillingPhoto alt={alt} src={isShown ? src : null} words={words} initial={initial} onFailed={setFailedSrc} />;
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
