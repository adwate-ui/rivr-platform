import { t } from '@rivr/i18n';
import { Icon } from '../Icon/Icon.tsx';
import { Text } from '../Text/Text.tsx';

export interface KillSwitchBannerProps {
  /** Members read that the club is paused; staff read that their writes are refused. */
  audience: 'member' | 'staff';
}

/**
 * The fixed banner every app shows while the venue is frozen (features, "Kill switch").
 * It has no close button: it goes when a second super admin releases the freeze.
 */
export function KillSwitchBanner({ audience }: KillSwitchBannerProps) {
  return (
    <div role="alert" className="flex items-center gap-2 bg-alert px-4 py-2 text-on-alert">
      <Icon name="alert" size="sm" />
      <Text as="span" variant="small" weight="medium" tone="onAlert">
        {t(audience === 'member' ? 'ui.killSwitch.member' : 'ui.killSwitch.staff')}
      </Text>
    </div>
  );
}
