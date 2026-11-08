import { t } from '@rivr/i18n';
import { useState } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { routeClick, type Navigate } from '../internal/navigation.ts';

export interface AvatarLinkProps {
  /** The member's initial; a profile icon stands in until it is known. */
  initial?: string | undefined;
  /** The address of the member's selfie, filling the circle in place of the initial; the initial while it loads or if it cannot. */
  photo?: string | undefined;
  /** Profile's address. */
  href: string;
  onNavigate?: Navigate | undefined;
}

/**
 * The member's photo, or their initial, in a 44 px circle at the top right of every tab screen (decision 0320): it opens
 * Profile, which has no tab of its own.
 */
export function AvatarLink({ initial, photo, href, onNavigate }: AvatarLinkProps) {
  // The address that failed to load, so the initial shows until a new one comes.
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const isPhoto = photo !== undefined && photo !== failedPhoto;
  return (
    <a href={href} aria-label={t('ui.profile.open')} onClick={(event) => routeClick(event, href, onNavigate)}
      className="flex size-touch shrink-0 items-center justify-center overflow-hidden rounded-full border border-control font-text text-16 font-semibold text-content">
      {isPhoto ? (
        <img src={photo} alt="" className="size-full object-cover" onError={() => setFailedPhoto(photo)} />
      ) : initial ? <span aria-hidden="true">{initial}</span> : <Icon name="profile" size="sm" />}
    </a>
  );
}
