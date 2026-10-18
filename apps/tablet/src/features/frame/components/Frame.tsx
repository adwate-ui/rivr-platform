import { useControlState } from '@rivr/db';
import { useT } from '@rivr/i18n';
import { KillSwitchBanner, TabletShell } from '@rivr/ui';
import type { ReactNode } from 'react';

/**
 * The dealer tablet's frame: the table it is fixed to and the kill-switch banner. Lane B adds
 * the table from the device's assignment and the offline banner from @rivr/offline.
 */
export function Frame({ children }: { children: ReactNode }) {
  const t = useT();
  const { isVenueFrozen } = useControlState();
  return (
    <TabletShell
      tableName={t('tablet.unassignedTable')}
      banner={isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}
    >
      {children}
    </TabletShell>
  );
}
