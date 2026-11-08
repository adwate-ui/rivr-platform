import { createContext, use, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BottomNav, type BottomNavItem, type PlayerTab } from '../BottomNav/BottomNav.tsx';
import { cx } from '../internal/classes.ts';
import type { Navigate } from '../internal/navigation.ts';
import { PlayerFrameContext } from '../internal/playerFrame.ts';
import { MAIN_ID, SkipLink } from '../internal/SkipLink.tsx';

export interface PlayerShellProps {
  children: ReactNode;
  /** The tabs with each one's access from `useFeature`. */
  tabs: readonly BottomNavItem[];
  currentTab?: PlayerTab | undefined;
  onNavigate?: Navigate | undefined;
  /**
   * The member's photo, or initial, at the right of the screen's header, opening Profile: on the tab screens. Left out on a screen with
   * its own way back. The screen's header draws it (Screen's heading row, or `PlayerAvatar` in a header of its own), so it
   * is centred on the title beside it and follows the header down under any banner above it.
   */
  avatar?: { initial: string | undefined; photo?: string | undefined; href: string } | undefined;
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
 * right of its header on the tab screens; then the dock and the tab bar along the foot. Pushed screens hide the tab bar.
 * `main` is a column, so a screen that grows fills the height between the top and the tab bar and can centre in it, as
 * Not found does.
 */
export function PlayerShell({ children, tabs, currentTab, onNavigate, avatar, isTabBarHidden = false, isFullBleed = false }: PlayerShellProps) {
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const frame = useMemo(() => ({ avatar, onNavigate, isFullBleed }), [avatar, onNavigate, isFullBleed]);
  return (
    <DockContext value={dock}>
      <PlayerFrameContext value={frame}>
        {/* data-shell: the page scrolls a focused control clear of the foot (styles.css, WCAG 2.4.11). */}
        <div data-shell="player" className={cx('safe-top max-medium:safe-x relative mx-auto flex min-h-dvh w-full flex-col bg-surface text-content medium:max-w-phone', isTabBarHidden && 'safe-bottom')}>
          <SkipLink />
          <main id={MAIN_ID} tabIndex={-1} className={cx('flex flex-1 flex-col pt-2 pb-8 outline-none', !isFullBleed && 'px-5')}>{children}</main>
          <div className="sticky bottom-0 z-nav">
            <div ref={setDock} />
            {isTabBarHidden ? null : <BottomNav items={tabs} current={currentTab} onNavigate={onNavigate} />}
          </div>
        </div>
      </PlayerFrameContext>
    </DockContext>
  );
}
