import type { ReactNode } from 'react';
import { BottomNav, type BottomNavItem, type PlayerTab } from '../BottomNav/BottomNav.tsx';
import { cx } from '../internal/classes.ts';
import type { Navigate } from '../internal/navigation.ts';
import { MAIN_ID, SkipLink } from '../internal/SkipLink.tsx';

export interface PlayerShellProps {
  children: ReactNode;
  /** The tabs with each one's access from `useFeature`. */
  tabs: readonly BottomNavItem[];
  currentTab?: PlayerTab | undefined;
  onNavigate?: Navigate | undefined;
  /** Hides the tab bar: a pushed screen with its own way back, such as Order, Profile or House rules. */
  isTabBarHidden?: boolean;
  /** Leaves the screen's sides to it, for a screen whose parts run edge to edge, such as Tonight. */
  isFullBleed?: boolean;
  /** Stays above the tab bar as the screen scrolls: Tonight's peek of all tables while the member waits or plays. */
  dock?: ReactNode;
}

/**
 * The player app frame on a 390 px phone (decision 0320): the screen, which heads itself (each tab screen's title and the
 * member's initial for Profile), then the dock and the tab bar along the foot. Pushed screens hide the tab bar.
 */
export function PlayerShell({ children, tabs, currentTab, onNavigate, isTabBarHidden = false, isFullBleed = false, dock }: PlayerShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col bg-surface text-content medium:max-w-phone">
      <SkipLink />
      <main id={MAIN_ID} tabIndex={-1} className={cx('flex-1 pt-2 pb-8 outline-none', !isFullBleed && 'px-5')}>{children}</main>
      {dock || !isTabBarHidden ? (
        <div className="sticky bottom-0 z-nav">
          {dock}
          {isTabBarHidden ? null : <BottomNav items={tabs} current={currentTab} onNavigate={onNavigate} />}
        </div>
      ) : null}
    </div>
  );
}
