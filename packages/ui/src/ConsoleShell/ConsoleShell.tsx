import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { ConsoleFrameContext } from '../internal/consoleFrame.ts';
import type { Navigate } from '../internal/navigation.ts';
import { MAIN_ID, SkipLink } from '../internal/SkipLink.tsx';
import type { SideNavItem, SideNavSection } from '../SideNav/SideNav.tsx';
import { WordmarkCard } from '../Wordmark/Wordmark.tsx';
import { ConsoleRail, useRailLabels } from './ConsoleRail.tsx';
import { ConsoleTabBar } from './ConsoleTabBar.tsx';

export interface ConsoleShellProps {
  children: ReactNode;
  /** The rail's groups and screens, filtered to the staff role; each screen with its icon. */
  sections: readonly SideNavSection[];
  /** The id of the rail item, or tab, for the current screen. */
  currentItem?: string | undefined;
  onNavigate?: Navigate | undefined;
  /** Above everything, across the whole width: the practice venue's stripe, the kill switch's banner, a prompt. */
  banner?: ReactNode;
  /** The header's start: `SearchTrigger`, a field from 768 px and a search button below. */
  search?: ReactNode;
  /** From 768 px, in the header: `HeaderPulse`, the night's counts. */
  pulse?: ReactNode;
  /** From 768 px, after the pulse: the clock, as `<Time at={now} tone="muted" />`. */
  clock?: ReactNode;
  /** The header's end at every width: the staff member's menu. */
  account?: ReactNode;
  /** Below 768 px, the tab bar's tabs (Floor, Requests, Waitlist, Door); the shell adds More, which opens every screen. */
  tabs?: readonly SideNavItem[];
  /** The screen's name in the phone's header; the current item's label unless given. */
  title?: string | undefined;
  /** Leaves the screen's padding to it, for a screen with a panel docked to its edge, such as the Live floor's requests. */
  isFullBleed?: boolean;
}

/** The label of the current screen, from the rail or the tabs. */
function labelOf(props: ConsoleShellProps): string | undefined {
  if (props.title !== undefined) return props.title;
  const items = [...props.sections.flatMap((section) => section.items), ...(props.tabs ?? [])];
  return items.find((item) => item.id === props.currentItem)?.label;
}

type HeaderProps = Pick<ConsoleShellProps, 'search' | 'pulse' | 'clock' | 'account'> & { title: string | undefined };

/**
 * The header over the screen: below 768 px the mark and the screen's name, then search and the staff member's menu; from
 * 768 px search, then the pulse and the clock at the right before the menu. Everything in it is centred on one line.
 */
function ConsoleHeader({ title, search, pulse, clock, account }: HeaderProps) {
  return (
    <header className="flex h-console-header shrink-0 items-center gap-3 px-4 medium:gap-4 medium:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3 medium:hidden">
        <span role="img" aria-label={t('ui.brand.label')} className="flex shrink-0"><WordmarkCard /></span>
        {title ? <p className="min-w-0 truncate font-text text-16 leading-snug font-semibold">{title}</p> : null}
      </div>
      {search ? <div className="flex shrink-0 medium:max-w-search medium:min-w-0 medium:flex-1">{search}</div> : null}
      <span aria-hidden="true" className="hidden flex-1 medium:block" />
      {pulse ? <div className="hidden items-center medium:flex">{pulse}</div> : null}
      {pulse && clock ? <span aria-hidden="true" className="hidden h-5 border-l border-subtle-hover medium:block" /> : null}
      {clock ? <div className="hidden items-center font-text text-14 text-content-muted medium:flex">{clock}</div> : null}
      {account ? <div className="flex shrink-0 items-center">{account}</div> : null}
    </header>
  );
}

/**
 * The staff console's frame (console v3, decision 0431). From 768 px a rail of 224 px with labels, or 64 px of icons,
 * folds to icons on its own below 1200 px and keeps the staff member's own choice on the device; beside it the header and
 * the screen, which scroll on their own. Below 768 px a header names the screen, and a tab bar along the foot holds the
 * app's tabs and More. The banner runs across the top above everything.
 */
export function ConsoleShell(props: ConsoleShellProps) {
  const { isLabelled, toggle } = useRailLabels();
  return (
    <div className="flex h-dvh flex-col bg-surface text-content">
      <SkipLink />
      {props.banner}
      <div className="flex min-h-0 flex-1">
        <ConsoleRail sections={props.sections} currentItem={props.currentItem} onNavigate={props.onNavigate} isLabelled={isLabelled} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ConsoleHeader title={labelOf(props)} search={props.search} pulse={props.pulse} clock={props.clock} account={props.account} />
          {/* Focusable, so a keyboard can scroll a screen that has nothing else to focus (loading, empty, read-only). Positioned, so
              a screen's visually hidden text stays inside it rather than lengthening the page. */}
          <main id={MAIN_ID} tabIndex={0} className={cx('relative min-h-0 flex-1 overflow-y-auto', props.isFullBleed !== true && 'px-4 pt-7 pb-10 medium:px-8')}>
            <ConsoleFrameContext value>{props.children}</ConsoleFrameContext>
          </main>
        </div>
      </div>
      <ConsoleTabBar tabs={props.tabs ?? []} sections={props.sections} currentItem={props.currentItem} onNavigate={props.onNavigate} />
    </div>
  );
}
