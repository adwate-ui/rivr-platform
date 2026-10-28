import * as Dialog from '@radix-ui/react-dialog';
import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import type { Navigate } from '../internal/navigation.ts';
import { SideNav, type SideNavSection } from '../SideNav/SideNav.tsx';
import { Text } from '../Text/Text.tsx';
import { Wordmark } from '../Wordmark/Wordmark.tsx';

export interface ConsoleShellProps {
  children: ReactNode;
  /** The rail's groups and screens, filtered to the staff role. */
  sections: readonly SideNavSection[];
  /** The id of the rail item for the current screen. */
  currentItem?: string | undefined;
  onNavigate?: Navigate | undefined;
  /** Across the top, for the kill-switch banner. */
  banner?: ReactNode;
  /** At the foot of the rail: who is signed in, the venue, and signing out. */
  railFooter?: ReactNode;
}

const ICON_BUTTON =
  'flex size-touch shrink-0 items-center justify-center rounded-md text-content focus-visible:outline-2 focus-visible:outline-focus';
const GO_TO =
  'min-h-touch w-full rounded-md border border-hairline bg-surface px-3 font-text text-16 text-content placeholder:text-content-muted ' +
  'focus-visible:outline-2 focus-visible:outline-focus';

/** The sections whose screens' names hold `query`, ignoring case; all of them while it is blank. */
function matching(sections: readonly SideNavSection[], query: string): readonly SideNavSection[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return sections;
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.label.toLowerCase().includes(wanted)) }))
    .filter((section) => section.items.length > 0);
}

/** Whether the side column shows: from the tablet breakpoint up, or always where the browser cannot say. */
function isAtDesk(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia(`(min-width: ${tokens.breakpoint.tablet}px)`).matches;
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

function isGoToKey(event: KeyboardEvent): boolean {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') return true;
  return event.key === '/' && !isTyping(event.target);
}

/** Ctrl+K, Cmd+K or / (outside a field) moves to Go to in the side column, at a desk. */
function useGoToShortcut(goTo: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isGoToKey(event) || goTo.current === null || !isAtDesk()) return;
      event.preventDefault();
      goTo.current.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo]);
}

interface RailProps {
  sections: readonly SideNavSection[];
  currentItem: string | undefined;
  onNavigate: Navigate | undefined;
  railFooter: ReactNode;
  goToRef?: RefObject<HTMLInputElement | null>;
}

/** What the rail holds, in the side column at a desk and in the menu below it: the mark, Go to, the screens and the foot. */
function Rail({ sections, currentItem, onNavigate, railFooter, goToRef }: RailProps) {
  const [query, setQuery] = useState('');
  const shown = matching(sections, query);
  const open = (href: string) => {
    setQuery('');
    if (onNavigate) onNavigate(href);
    else window.location.assign(href);
  };
  return (
    <>
      <div className="px-6">
        <Wordmark withTagline />
      </div>
      <div className="px-3">
        <input
          ref={goToRef} type="search" value={query} aria-label={t('ui.consoleRail.goTo')} placeholder={t('ui.consoleRail.goTo')}
          className={GO_TO} onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            const first = shown[0]?.items[0];
            if (event.key === 'Enter' && first) open(first.href);
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {shown.length === 0 ? (
          <Text tone="muted">{t('ui.consoleRail.noMatch')}</Text>
        ) : (
          <SideNav label={t('ui.consoleRail.label')} sections={shown} current={currentItem} onNavigate={onNavigate === undefined ? undefined : open} />
        )}
      </div>
      {railFooter ? <div className="shrink-0 px-6">{railFooter}</div> : null}
    </>
  );
}

/** Below a desk: the menu button and the current screen's name, across the top. */
function TopBar({ title, isMenuOpen, onOpenMenu }: { title: string | undefined; isMenuOpen: boolean; onOpenMenu: () => void }) {
  return (
    <header className="flex h-header shrink-0 items-center gap-1 border-b border-hairline bg-raised px-2 tablet:hidden">
      <button type="button" aria-label={t('ui.consoleRail.open')} aria-expanded={isMenuOpen} aria-haspopup="dialog" className={ICON_BUTTON} onClick={onOpenMenu}>
        <Icon name="menu" />
      </button>
      {title ? <p className="min-w-0 truncate font-text text-16 font-medium">{title}</p> : null}
    </header>
  );
}

/** The rail as a menu over the screen below a desk. Escape, a tap outside, Close or choosing a screen closes it. */
function MenuDrawer({ isOpen, onOpenChange, children }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; children: ReactNode }) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-green-black opacity-muted" />
        {/* Focus moves to the menu itself, not Go to, so a phone's keyboard does not cover the screens. */}
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-modal flex w-rail max-w-full flex-col gap-8 bg-raised py-6 shadow-modal focus:outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
          }}
        >
          <Dialog.Title className="sr-only">{t('ui.consoleRail.label')}</Dialog.Title>
          <Dialog.Close aria-label={t('ui.consoleRail.close')} className={`absolute top-2 right-2 ${ICON_BUTTON}`}>
            <Icon name="close" />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The staff console's frame at every size. From the tablet breakpoint (1180 px) up, the rail sits beside the screen;
 * below it, a top bar names the screen and its menu button opens the rail over it. The rail's Go to finds a screen by
 * name (Ctrl+K or / at a desk). The rail's screens and the screen each scroll on their own, and the foot of the rail (who
 * is signed in, signing out) always stays in view.
 */
export function ConsoleShell({ children, sections, currentItem, onNavigate, banner, railFooter }: ConsoleShellProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const goToRef = useRef<HTMLInputElement>(null);
  useGoToShortcut(goToRef);
  const title = sections.flatMap((section) => section.items).find((item) => item.id === currentItem)?.label;
  // Choosing a screen in the menu closes it.
  const navigateFromMenu: Navigate | undefined = onNavigate && ((href) => {
    setMenuOpen(false);
    onNavigate(href);
  });
  return (
    <div className="flex h-dvh flex-col bg-surface text-content">
      {banner}
      <TopBar title={title} isMenuOpen={isMenuOpen} onOpenMenu={() => setMenuOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-rail shrink-0 flex-col gap-8 border-r border-hairline bg-raised py-6 tablet:flex">
          <Rail sections={sections} currentItem={currentItem} onNavigate={onNavigate} railFooter={railFooter} goToRef={goToRef} />
        </aside>
        {/* Focusable, so a keyboard can scroll a screen that has nothing else to focus (loading, empty, read-only). */}
        <main tabIndex={0} className="min-w-0 flex-1 overflow-y-auto px-4 py-4 tablet:px-8 tablet:py-6">
          {children}
        </main>
      </div>
      <MenuDrawer isOpen={isMenuOpen} onOpenChange={setMenuOpen}>
        <Rail sections={sections} currentItem={currentItem} onNavigate={navigateFromMenu} railFooter={railFooter} />
      </MenuDrawer>
    </div>
  );
}
