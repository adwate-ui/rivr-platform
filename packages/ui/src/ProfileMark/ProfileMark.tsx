import { t } from '@rivr/i18n';
import { useState } from 'react';

export interface ProfileMarkProps {
  /** The member's initial, shown until there is a photo. */
  initial: string;
  /** The address of the member's verified selfie (decision 0300), filling the circle; the initial while it loads or if it cannot. */
  photo?: string | undefined;
}

/** The member at the head of Profile (decision 0320): their photo, or their initial, in a 64 px gold-edged circle. */
export function ProfileMark({ initial, photo }: ProfileMarkProps) {
  // The address that failed to load, so the initial shows until a new one comes.
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const isPhoto = photo !== undefined && photo !== failedPhoto;
  return (
    <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold font-display text-28 text-content">
      {isPhoto ? (
        <img src={photo} alt={t('ui.profile.photo')} className="size-full object-cover" onError={() => setFailedPhoto(photo)} />
      ) : <span aria-hidden="true">{initial}</span>}
    </span>
  );
}
