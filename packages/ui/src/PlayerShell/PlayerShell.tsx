import { createContext, use, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AvatarLink } from '../AvatarLink/AvatarLink.tsx';
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
  /** The member's initial at the top right, opening Profile: on the tab screens. Left out on a screen with its own way back. */
  avatar?: { initial: string | undefined; href: string } | undefined;
  /** Hides the tab bar: a pushed screen with its own way back, such as Order, Profile or House rules. */
  isTabBarHidden?: boolean;
  /** Leaves the screen's sides to it, for a screen whose parts run edge to edge, such as Tonight. */
  isFullBleed?: boolean;
}

const DockContext = createContext<HTMLElement | null>(null);

/**
 * Something a screen keeps above the tab bar as it scrolls (decision 0320): Tonight's peek of all tables while the member
 * waits or plays. Drawn into the shell's dock; nothing outside a PlayerShell.
 */
export function PlayerDock({ children }: { children: ReactNode }) {
  const dock = use(DockContext);
  return dock === null ? null : createPortal(children, dock);
}

/**
 * The player app frame on a 390 px phone (decision 0320): the screen, which heads itself, with the member's initial at the
 * top right on the tab screens; then the dock and the tab bar along the foot. Pushed screens hide the tab bar.
 */
export function PlayerShell({ children, tabs, currentTab, onNavigate, avatar, isTabBarHidden = false, isFullBleed = false }: PlayerShellProps) {
  const [dock, setDock] = useState<HTMLElement | null>(null);
  return (
    <DockContext value={dock}>
      <div className="relative mx-auto flex min-h-dvh w-full flex-col bg-surface text-content medium:max-w-phone">
        <SkipLink />
        <main id={MAIN_ID} tabIndex={-1} className={cx('flex-1 pt-2 pb-8 outline-none', !isFullBleed && 'px-5')}>{children}</main>
        {avatar ? (
          <div className="absolute top-2 right-5">
            <AvatarLink initial={avatar.initial} href={avatar.href} onNavigate={onNavigate} />
          </div>
        ) : null}
        <div className="sticky bottom-0 z-nav">
          <div ref={setDock} />
          {isTabBarHidden ? null : <BottomNav items={tabs} current={currentTab} onNavigate={onNavigate} />}
        </div>
      </div>
    </DockContext>
  );
}
