import { useId, useState } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';
import type { Navigate } from '../internal/navigation.ts';
import { NavItem, type SideNavItem } from './NavItem.tsx';

export interface SideNavSection {
  id: string;
  /**
   * The group heading (Tonight, Players...). Leave it out for a section that is a single link, so the name does not
   * show twice.
   */
  label?: string | undefined;
  items: readonly SideNavItem[];
  /** Folds under its heading, as Admin does: shut until opened, and open while the current screen is in it. */
  isCollapsible?: boolean | undefined;
}

interface NavGroupProps {
  section: SideNavSection;
  current: string | undefined;
  isCollapsed: boolean;
  onNavigate: Navigate | undefined;
}

const HEADING = 'font-text text-12 leading-snug font-medium uppercase tracking-wide text-content-muted';

/**
 * One group of the rail: its heading, then its screens. A collapsible group's heading is a button that opens and shuts
 * it. Folded to icons, the rail shows no headings and every screen, the group named for screen readers only.
 */
export function NavGroup({ section, current, isCollapsed, onNavigate }: NavGroupProps) {
  const headingId = useId();
  const listId = useId();
  const holdsCurrent = section.items.some((item) => item.id === current);
  const [isOpen, setOpen] = useState(false);
  const canFold = section.isCollapsible === true && !isCollapsed && section.label !== undefined;
  const isShut = canFold && !isOpen && !holdsCurrent;
  return (
    <div className="flex flex-col gap-1">
      {section.label === undefined ? null : (
        <GroupHeading id={headingId} label={section.label} isHidden={isCollapsed}
          fold={canFold ? { isShut, listId, onToggle: () => setOpen(isShut), isLocked: holdsCurrent } : undefined} />
      )}
      {isShut ? null : (
        <ul id={listId} aria-labelledby={section.label === undefined ? undefined : headingId} className="flex flex-col">
          {section.items.map((item) => (
            <li key={item.id}>
              <NavItem item={item} isCurrent={item.id === current} isCollapsed={isCollapsed} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface GroupHeadingProps {
  id: string;
  label: string;
  isHidden: boolean;
  /** A collapsible group's state; `isLocked` while the current screen is in it, so it cannot hide where the staff member is. */
  fold: { isShut: boolean; listId: string; onToggle: () => void; isLocked: boolean } | undefined;
}

function GroupHeading({ id, label, isHidden, fold }: GroupHeadingProps) {
  if (isHidden) return <span id={id} className="sr-only">{label}</span>;
  if (fold === undefined) return <p id={id} className={cx(HEADING, 'px-3 pb-1')}>{label}</p>;
  return (
    <button type="button" aria-expanded={!fold.isShut} aria-controls={fold.isShut ? undefined : fold.listId} aria-disabled={fold.isLocked || undefined}
      onClick={fold.isLocked ? undefined : fold.onToggle}
      className={cx(HEADING, 'flex min-h-touch items-center justify-between rounded-md px-3 transition-colors hover:text-content tablet:min-h-8',
        'focus-visible:outline focus-visible:outline-focus')}>
      <span id={id}>{label}</span>
      <Icon name={fold.isShut ? 'chevronDown' : 'chevronUp'} size="sm" />
    </button>
  );
}
