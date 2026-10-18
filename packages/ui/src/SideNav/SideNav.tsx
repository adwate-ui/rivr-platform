import { useId } from 'react';
import { cx } from '../internal/classes.ts';
import { routeClick, type Navigate } from '../internal/navigation.ts';

export interface SideNavItem {
  id: string;
  /** Already translated, for example `t('ui.consoleRail.items.cage')`. */
  label: string;
  href: string;
}

export interface SideNavSection {
  id: string;
  /** The group heading (Floor, Money...). No icon sits beside it. */
  label: string;
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
      <p id={headingId} className="px-3 font-text text-13 text-content-muted">
        {section.label}
      </p>
      <ul aria-labelledby={headingId} className="flex flex-col">
        {section.items.map((item) => (
          <li key={item.id}>
            <a
              href={item.href}
              aria-current={item.id === current ? 'page' : undefined}
              onClick={(event) => routeClick(event, item.href, onNavigate)}
              className={cx(
                'flex min-h-8 items-center rounded-md px-3 font-text text-16 transition-colors',
                item.id === current ? 'font-medium text-content' : 'text-content-muted hover:text-content',
              )}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
