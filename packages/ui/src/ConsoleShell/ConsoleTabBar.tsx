import * as Dialog from '@radix-ui/react-dialog';
import { t } from '@rivr/i18n';
import { useId, useRef, useState, type RefObject } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { routeClick, type Navigate } from '../internal/navigation.ts';
import { SideNav, type SideNavItem, type SideNavSection } from '../SideNav/SideNav.tsx';

interface ConsoleTabBarProps {
  tabs: readonly SideNavItem[];
  sections: readonly SideNavSection[];
  currentItem: string | undefined;
  onNavigate: Navigate | undefined;
}

const TAB = 'flex h-full w-full flex-col items-center justify-center gap-1 font-text text-12 leading-snug transition-colors';

const ICON_BUTTON = 'flex size-touch shrink-0 items-center justify-center rounded-md text-content';

/** A tab's count over its icon's corner: gold when it asks for action, muted when it informs. */
function TabBadge({ count, isActionable }: { count: number; isActionable: boolean }) {
  return (
    <span aria-hidden="true" className={cx('absolute -top-2 left-3 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-12 leading-tight font-semibold tabular-nums',
      isActionable ? 'bg-action text-on-action' : 'bg-cream-track text-content')}>
      {count}
    </span>
  );
}

function TabLink({ tab, isCurrent, onNavigate }: { tab: SideNavItem; isCurrent: boolean; onNavigate: Navigate | undefined }) {
  const waiting = tab.count !== undefined && tab.count > 0 ? tab.count : null;
  const descriptionId = useId();
  return (
    <a href={tab.href} aria-current={isCurrent ? 'page' : undefined} aria-describedby={waiting === null ? undefined : descriptionId}
      onClick={(event) => routeClick(event, tab.href, onNavigate)} className={cx(TAB, isCurrent ? 'font-medium text-content' : 'text-content-muted')}>
      <span className="relative flex">
        <Icon name={tab.icon} />
        {waiting === null ? null : <TabBadge count={waiting} isActionable={tab.isActionable === true} />}
      </span>
      {tab.label}
      {waiting === null ? null : <span id={descriptionId} aria-hidden="true" className="sr-only">{tab.countLabel ?? t('ui.consoleRail.waiting', { count: waiting })}</span>}
    </a>
  );
}

/**
 * Below 768 px (console v3): the tabs along the foot of the screen, which the app chooses (Floor, Requests, Waitlist,
 * Door), and More, which opens every screen of the rail over the page. Choosing one there closes it and leaves the focus
 * with the new screen.
 */
export function ConsoleTabBar({ tabs, sections, currentItem, onNavigate }: ConsoleTabBarProps) {
  const [isMoreOpen, setMoreOpen] = useState(false);
  const closedByChoosing = useRef(false);
  const choose: Navigate | undefined = onNavigate && ((href) => {
    closedByChoosing.current = true;
    setMoreOpen(false);
    onNavigate(href);
  });
  return (
    <Dialog.Root open={isMoreOpen} onOpenChange={setMoreOpen}>
      <nav aria-label={t('ui.console.shell.tabs')} className="shrink-0 bg-raised medium:hidden">
        <ul className="flex h-bottom-nav">
          {tabs.map((tab) => (
            <li key={tab.id} className="flex min-w-0 flex-1">
              <TabLink tab={tab} isCurrent={tab.id === currentItem} onNavigate={onNavigate} />
            </li>
          ))}
          <li className="flex min-w-0 flex-1">
            <Dialog.Trigger className={cx(TAB, isMoreOpen ? 'font-medium text-content' : 'text-content-muted')}>
              <Icon name="overflow" />
              {t('ui.console.shell.more')}
            </Dialog.Trigger>
          </li>
        </ul>
      </nav>
      <MoreMenu sections={sections} currentItem={currentItem} onNavigate={choose} closedByChoosingRef={closedByChoosing} />
    </Dialog.Root>
  );
}

interface MoreMenuProps {
  sections: readonly SideNavSection[];
  currentItem: string | undefined;
  onNavigate: Navigate | undefined;
  /** Set when a screen was chosen: the new screen keeps the focus rather than More taking it back. */
  closedByChoosingRef: RefObject<boolean>;
}

/** Every screen of the rail over the page, above the tab bar, with its title and Close. */
function MoreMenu({ sections, currentItem, onNavigate, closedByChoosingRef }: MoreMenuProps) {
  return (
    <Dialog.Portal>
      <Dialog.Content aria-describedby={undefined}
        className="fixed inset-x-0 top-0 bottom-bottom-nav z-modal flex flex-col gap-3 overflow-y-auto bg-surface px-4 pt-2 pb-6 text-content focus:outline-none medium:hidden"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (!closedByChoosingRef.current) return;
          event.preventDefault();
          closedByChoosingRef.current = false;
        }}>
        <div className="flex min-h-touch items-center justify-between">
          <Dialog.Title className="font-text text-16 leading-snug font-semibold">{t('ui.console.shell.moreTitle')}</Dialog.Title>
          <Dialog.Close aria-label={t('ui.console.shell.closeMore')} className={ICON_BUTTON}><Icon name="close" /></Dialog.Close>
        </div>
        <SideNav label={t('ui.consoleRail.label')} sections={sections} current={currentItem} onNavigate={onNavigate} />
      </Dialog.Content>
    </Dialog.Portal>
  );
}
