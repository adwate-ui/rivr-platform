import { useControlState } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ConsoleShell, KillSwitchBanner, type SideNavSection } from '@rivr/ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/**
 * The console's frame: the left rail and the kill-switch banner. The rail lists only screens that
 * exist; each lane adds its items as it builds them, and lane A filters the rail by staff role.
 */
export function Frame({ children }: { children: ReactNode }) {
  const { isVenueFrozen } = useControlState();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const sections: SideNavSection[] = [
    {
      id: 'floor',
      label: t('ui.consoleRail.groups.floor'),
      items: [{ id: 'liveFloor', label: t('ui.consoleRail.items.liveFloor'), href: '/' }],
    },
  ];
  return (
    <ConsoleShell
      sections={sections}
      currentItem={pathname === '/' ? 'liveFloor' : undefined}
      onNavigate={(href) => void navigate({ href })}
      banner={isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}
    >
      {children}
    </ConsoleShell>
  );
}
