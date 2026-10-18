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
  /** At the foot of the rail: who is signed in, the venue, and signing out. */
  railFooter?: ReactNode;
}

/**
 * The floor console frame at 1440 px: banner, the left rail, and the screen. The frame fills the
 * window: the rail's list of screens and the screen each scroll on their own, and the foot of the
 * rail (who is signed in, signing out) always stays in view, however many screens the rail lists.
 */
export function ConsoleShell({ children, sections, currentItem, onNavigate, banner, railFooter }: ConsoleShellProps) {
  return (
    <div className="flex h-dvh flex-col bg-surface text-content">
      {banner}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-rail shrink-0 flex-col gap-8 border-r border-hairline bg-raised py-6">
          <div className="px-6">
            <Wordmark withTagline />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3">
            <SideNav label={t('ui.consoleRail.label')} sections={sections} current={currentItem} onNavigate={onNavigate} />
          </div>
          {railFooter ? <div className="shrink-0 px-6">{railFooter}</div> : null}
        </aside>
        {/* Focusable, so a keyboard can scroll a screen that has nothing else to focus (loading, empty, read-only). */}
        <main tabIndex={0} className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
