import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import type { Navigate } from '../internal/navigation.ts';
import { SideNav, type SideNavSection } from '../SideNav/SideNav.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface ConsoleShellProps {
  children: ReactNode;
  /** The rail, grouped Floor, Money, Players, Growth, Team and Reports, filtered to the staff role. */
  sections: readonly SideNavSection[];
  /** The id of the rail item for the current screen. */
  currentItem?: string | undefined;
  onNavigate?: Navigate | undefined;
  /** Across the top, for the kill-switch banner. */
  banner?: ReactNode;
}

/** The floor console frame at 1440 px: banner, the left rail, and the screen. */
export function ConsoleShell({ children, sections, currentItem, onNavigate, banner }: ConsoleShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-content">
      {banner}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-rail shrink-0 flex-col gap-8 border-r border-hairline bg-raised px-3 py-6">
          <div className="px-3">
            <Wordmark withTagline />
          </div>
          <SideNav label={t('ui.consoleRail.label')} sections={sections} current={currentItem} onNavigate={onNavigate} />
        </aside>
        <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
