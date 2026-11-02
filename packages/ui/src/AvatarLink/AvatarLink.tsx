import { t } from '@rivr/i18n';
import { Icon } from '../Icon/Icon.tsx';
import { routeClick, type Navigate } from '../internal/navigation.ts';

export interface AvatarLinkProps {
  /** The member's initial; a profile icon stands in until it is known. */
  initial?: string | undefined;
  /** Profile's address. */
  href: string;
  onNavigate?: Navigate | undefined;
}

/**
 * The member's initial in a 44 px circle at the top right of every tab screen (decision 0320): it opens Profile, which has
 * no tab of its own.
 */
export function AvatarLink({ initial, href, onNavigate }: AvatarLinkProps) {
  return (
    <a href={href} aria-label={t('ui.profile.open')} onClick={(event) => routeClick(event, href, onNavigate)}
      className="flex size-touch shrink-0 items-center justify-center rounded-full border border-control font-text text-16 font-semibold text-content">
      {initial ? <span aria-hidden="true">{initial}</span> : <Icon name="profile" size="sm" />}
    </a>
  );
}
