import { useControlState } from '@rivr/db';
import { t } from '@rivr/i18n';
import { DriverShell, KillSwitchBanner } from '@rivr/ui';
import type { ReactNode } from 'react';

/**
 * The cab driver app's frame: the pickups heading and the kill-switch banner. Lane C adds the
 * trip screens, the foreground location service and drop confirmation by player code.
 */
export function Frame({ children }: { children: ReactNode }) {
  const { isVenueFrozen } = useControlState();
  return (
    <DriverShell
      title={t('driver.pickups.title')}
      banner={isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}
    >
      {children}
    </DriverShell>
  );
}
