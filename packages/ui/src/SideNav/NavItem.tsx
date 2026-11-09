import { t } from '@rivr/i18n';
import { useId } from 'react';
import { Icon, type IconName } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import { routeClick, type Navigate } from '../internal/navigation.ts';

export interface SideNavItem {
  id: string;
  /** Already translated, for example `t('console.rail.items.floor')`. */
  label: string;
  href: string;
  /** Shown beside the label, and alone when the rail is folded to icons or on the phone's tab bar. */
  icon: IconName;
  /** How many things wait on the screen (#317); shown when above 0 and read as "2 waiting", or as `countLabel`. */
  count?: number | undefined;
  /** What the count is, read out when it is not people waiting: `14 requests`, `3 open tickets` (audit F-129). */
  countLabel?: string | undefined;
  /**
   * The count asks the staff member to act, such as requests or orders: a solid gold badge (decision 0463). Otherwise the
   * count is for information, such as feedback tickets, and its badge is muted.
   */
  isActionable?: boolean | undefined;
  /** A screen that destroys or stops things (Kill switch, Practice reset, Purge): its name in the danger colour. */
  tone?: 'danger' | undefined;
}

interface NavItemProps {
  item: SideNavItem;
  isCurrent: boolean;
  /** Icons alone: the label is read out and shown as a tooltip, and a count is a dot. */
  isCollapsed: boolean;
  onNavigate: Navigate | undefined;
}

/** The count's badge: a gold pill with the number, or a muted one; a dot at the icon's corner when the rail is folded. */
function Badge({ count, isActionable, isCollapsed }: { count: number; isActionable: boolean; isCollapsed: boolean }) {
  const fill = isActionable ? 'bg-action text-on-action' : 'bg-cream-track text-content';
  if (isCollapsed) return <span aria-hidden="true" className={cx('absolute top-2 right-2 size-2 rounded-full', fill)} />;
  return (
    <span aria-hidden="true" className={cx('flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 font-text text-12 leading-tight font-semibold tabular-nums', fill)}>
      {count}
    </span>
  );
}

function itemTone(item: SideNavItem, isCurrent: boolean): string {
  if (item.tone === 'danger') return 'text-danger';
  return isCurrent ? 'text-content' : 'text-content-muted hover:text-content';
}

/** What the count is, in words: the entry's own, or that people wait. */
const countWords = (item: { countLabel?: string | undefined }, count: number) => item.countLabel ?? t('ui.consoleRail.waiting', { count });

/**
 * One screen in the console's rail (console v3): its icon, its name and what waits on it. Its name is its label whatever
 * waits, and its description says how many (decision 0301), so a screen reader hears both and the link keeps one name.
 * The current screen sits on a faint fill. 36 px tall at a desk; a finger's 44 px below 1180 px (decision 0282).
 */
export function NavItem({ item, isCurrent, isCollapsed, onNavigate }: NavItemProps) {
  const waiting = item.count !== undefined && item.count > 0 ? item.count : null;
  const descriptionId = useId();
  return (
    <a href={item.href} aria-current={isCurrent ? 'page' : undefined} aria-describedby={waiting === null ? undefined : descriptionId}
      title={isCollapsed ? item.label : undefined} onClick={(event) => routeClick(event, item.href, onNavigate)}
      className={cx(
        'relative flex min-h-touch items-center gap-3 rounded-md font-text text-14 leading-control transition-colors tablet:min-h-control',
        'focus-visible:outline focus-visible:outline-focus',
        isCollapsed ? 'justify-center' : 'px-3',
        isCurrent ? 'bg-subtle-hover font-semibold' : 'hover:bg-subtle',
        itemTone(item, isCurrent),
      )}>
      <Icon name={item.icon} size="sm" />
      <span className={isCollapsed ? 'sr-only' : 'min-w-0 flex-1 truncate'}>{item.label}</span>
      {waiting === null ? null : (
        <>
          <Badge count={waiting} isActionable={item.isActionable === true} isCollapsed={isCollapsed} />
          {/* Out of the name, read as the description, which reaches hidden text by its id. */}
          <span id={descriptionId} aria-hidden="true" className="sr-only">{countWords(item, waiting)}</span>
        </>
      )}
    </a>
  );
}
