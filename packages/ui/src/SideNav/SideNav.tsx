import { t } from '@rivr/i18n';
import { useId } from 'react';
import { cx } from '../internal/classes.ts';
import { routeClick, type Navigate } from '../internal/navigation.ts';

export interface SideNavItem {
  id: string;
  /** Already translated, for example `t('console.rail.items.cage')`. */
  label: string;
  href: string;
  /** How many things wait on the screen, such as high-hand claims (#317); shown beside the label when above 0. */
  count?: number | undefined;
}

export interface SideNavSection {
  id: string;
  /**
   * The group heading (Floor, Money...). No icon sits beside it. Leave it out for a section that
   * is a single link, such as Reports, so the name does not show twice.
   */
  label?: string | undefined;
  items: readonly SideNavItem[];
}

export interface SideNavProps {
  /** Names the navigation landmark. */
  label: string;
  sections: readonly SideNavSection[];
  /** The id of the item for the current screen. */
  current?: string | undefined;
  onNavigate?: Navigate | undefined;
}

/** The console's left rail: grouped sections of links, with the current screen marked. */
export function SideNav({ label, sections, current, onNavigate }: SideNavProps) {
  return (
    <nav aria-label={label} className="flex flex-col gap-5">
      {sections.map((section) => (
        <RailSection key={section.id} section={section} current={current} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

interface RailSectionProps {
  section: SideNavSection;
  current: string | undefined;
  onNavigate: Navigate | undefined;
}

function RailSection({ section, current, onNavigate }: RailSectionProps) {
  const headingId = useId();
  return (
    <div className="flex flex-col gap-1">
      {section.label ? (
        <p id={headingId} className="px-3 font-text text-13 text-content-muted">
          {section.label}
        </p>
      ) : null}
      <ul aria-labelledby={section.label ? headingId : undefined} className="flex flex-col">
        {section.items.map((item) => (
          <li key={item.id}>
            <RailLink item={item} isCurrent={item.id === current} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One entry; with things waiting on its screen, the number in gold beside it, and its name says how many. */
function RailLink({ item, isCurrent, onNavigate }: { item: SideNavItem; isCurrent: boolean; onNavigate: Navigate | undefined }) {
  const waiting = item.count !== undefined && item.count > 0 ? item.count : null;
  return (
    <a
      href={item.href}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={waiting === null ? undefined : `${item.label} ${t('ui.consoleRail.waiting', { count: waiting })}`}
      onClick={(event) => routeClick(event, item.href, onNavigate)}
      className={cx(
        // A finger's width below a desk, where the rail is the console's menu.
        'flex min-h-touch items-center gap-2 rounded-md px-3 font-text text-16 transition-colors tablet:min-h-8',
        isCurrent ? 'font-medium text-content' : 'text-content-muted hover:text-content',
      )}
    >
      {item.label}
      {waiting === null ? null : (
        <span className="ml-auto rounded-md bg-action px-2 font-text text-13 font-medium tabular-nums text-on-action">{waiting}</span>
      )}
    </a>
  );
}
