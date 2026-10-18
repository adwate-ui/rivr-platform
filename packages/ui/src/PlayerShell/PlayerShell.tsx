import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { BottomNav, type BottomNavItem, type PlayerTab } from '../BottomNav/BottomNav.tsx';
import { Icon } from '../Icon/Icon.tsx';
import { routeClick, type Navigate } from '../internal/navigation.ts';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface PlayerShellProps {
  children: ReactNode;
  /** The five tabs with each one's access from `useFeature`. */
  tabs: readonly BottomNavItem[];
  currentTab?: PlayerTab | undefined;
  /** The member's initial, shown top right; it opens Profile. A profile icon stands in until it is known. */
  memberInitial?: string | undefined;
  profileHref: string;
  onNavigate?: Navigate | undefined;
  /** Above everything: the kill-switch banner, or while the phone is offline the offline banner. */
  banner?: ReactNode;
}

/** The player app frame on a 390 px phone: banner, wordmark and the member's initial, the screen, and the tab bar. */
export function PlayerShell({ children, tabs, currentTab, memberInitial, profileHref, onNavigate, banner }: PlayerShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col bg-surface text-content">
      {banner}
      <header className="flex h-header shrink-0 items-center justify-between pr-2 pl-4">
        <Wordmark />
        <a
          href={profileHref}
          aria-label={t('ui.profile.open')}
          onClick={(event) => routeClick(event, profileHref, onNavigate)}
          className="flex size-touch items-center justify-center rounded-md"
        >
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-md border border-hairline bg-raised font-text text-16 font-medium"
          >
            {memberInitial ? memberInitial : <Icon name="profile" size="sm" />}
          </span>
        </a>
      </header>
      <main className="flex-1 px-4 pt-4 pb-8">{children}</main>
      <div className="sticky bottom-0 z-nav">
        <BottomNav items={tabs} current={currentTab} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
