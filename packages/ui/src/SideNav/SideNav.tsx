import type { Navigate } from '../internal/navigation.ts';
import { NavGroup, type SideNavSection } from './NavGroup.tsx';

export type { SideNavItem } from './NavItem.tsx';
export type { SideNavSection } from './NavGroup.tsx';

export interface SideNavProps {
  /** Names the navigation landmark. */
  label: string;
  sections: readonly SideNavSection[];
  /** The id of the item for the current screen. */
  current?: string | undefined;
  onNavigate?: Navigate | undefined;
  /** The rail folded to its icons (console v3): no headings, each count a dot, each name a tooltip and read out. */
  isCollapsed?: boolean;
}

/**
 * The console's screens in their groups (console v3): each with its icon, name and what waits on it, the current one on
 * a faint fill. ConsoleShell's rail holds it, labelled or folded to icons, and so does its phone menu, More.
 */
export function SideNav({ label, sections, current, onNavigate, isCollapsed = false }: SideNavProps) {
  return (
    <nav aria-label={label} className="flex flex-col gap-5">
      {sections.map((section) => (
        <NavGroup key={section.id} section={section} current={current} isCollapsed={isCollapsed} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
