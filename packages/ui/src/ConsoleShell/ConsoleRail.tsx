import { t } from '@rivr/i18n';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import type { Navigate } from '../internal/navigation.ts';
import { SideNav, type SideNavSection } from '../SideNav/SideNav.tsx';
import { useIsWide } from '../useIsWide/useIsWide.ts';
import { Wordmark, WordmarkCard } from '../Wordmark/Wordmark.tsx';

/** Where the staff member's choice of rail, labels or icons, is kept on the device. */
export const RAIL_KEY = 'rivr.console.rail';

type RailChoice = 'labels' | 'icons';

function storedChoice(): RailChoice | null {
  try {
    const value = window.localStorage.getItem(RAIL_KEY);
    return value === 'labels' || value === 'icons' ? value : null;
  } catch {
    // Storage refused, as in a private window: the rail follows the width.
    return null;
  }
}

function keepChoice(choice: RailChoice): void {
  try {
    window.localStorage.setItem(RAIL_KEY, choice);
  } catch {
    // Storage refused: the choice lasts until the page reloads.
  }
}

/**
 * Whether the rail shows its labels: the staff member's own choice once made, kept on the device; until then, from
 * 1200 px up, and icons alone below, as on the floor's 1180 px tablets.
 */
export function useRailLabels(): { isLabelled: boolean; toggle: () => void } {
  const isWide = useIsWide('wide');
  const [choice, setChoice] = useState<RailChoice | null>(storedChoice);
  const isLabelled = choice === null ? isWide : choice === 'labels';
  const toggle = () => {
    const next: RailChoice = isLabelled ? 'icons' : 'labels';
    keepChoice(next);
    setChoice(next);
  };
  return { isLabelled, toggle };
}

interface ConsoleRailProps {
  sections: readonly SideNavSection[];
  currentItem: string | undefined;
  onNavigate: Navigate | undefined;
  isLabelled: boolean;
  onToggle: () => void;
}

/**
 * The rail's list, scrolled so the current screen's item shows in a rail taller than the window (audit F-135): when a
 * screen opens, and when the rail's height changes, as a banner arriving above it or a shorter window takes room.
 */
function useCurrentInView(currentItem: string | undefined) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = list.current;
    if (element === null) return undefined;
    const show = () => element.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' });
    show();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(show);
    observer.observe(element);
    return () => observer.disconnect();
  }, [currentItem]);
  return list;
}

/**
 * The console's rail from 768 px (console v3): the mark, the screens in their groups, and at its foot Collapse or Expand.
 * 224 px with labels, or 64 px of icons. Its screens scroll on their own, fading at the foot; the mark and the foot stay.
 */
export function ConsoleRail({ sections, currentItem, onNavigate, isLabelled, onToggle }: ConsoleRailProps) {
  const toggleLabel = t(isLabelled ? 'ui.console.shell.collapse' : 'ui.console.shell.expand');
  const list = useCurrentInView(currentItem);
  return (
    <aside className={cx('hidden shrink-0 flex-col bg-raised medium:flex', isLabelled ? 'w-rail' : 'w-rail-collapsed')}>
      <div className={cx('flex h-console-header shrink-0 items-center', isLabelled ? 'px-6' : 'justify-center')}>
        {isLabelled ? <Wordmark /> : <span role="img" aria-label={t('ui.brand.label')} className="flex"><WordmarkCard /></span>}
      </div>
      <div ref={list} className="rail-fade min-h-0 flex-1 scroll-pb-8 overflow-x-hidden overflow-y-auto px-3 pt-1 pb-8">
        <SideNav label={t('ui.consoleRail.label')} sections={sections} current={currentItem} onNavigate={onNavigate} isCollapsed={!isLabelled} />
      </div>
      <div className="shrink-0 p-3">
        <button type="button" onClick={onToggle} title={isLabelled ? undefined : toggleLabel}
          className={cx(
            'flex min-h-touch w-full items-center gap-3 rounded-md font-text text-13 leading-control text-content-muted transition-colors',
            'hover:bg-subtle hover:text-content focus-visible:outline-2 focus-visible:outline-focus tablet:min-h-control',
            isLabelled ? 'px-3' : 'justify-center',
          )}>
          <Icon name={isLabelled ? 'chevronLeft' : 'chevronRight'} size="sm" />
          <span className={isLabelled ? undefined : 'sr-only'}>{toggleLabel}</span>
        </button>
      </div>
    </aside>
  );
}
