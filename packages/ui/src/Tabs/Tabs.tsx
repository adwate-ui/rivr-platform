import { cx } from '../internal/classes.ts';
import { routeClick, type Navigate } from '../internal/navigation.ts';

export interface TabItem {
  readonly id: string;
  /** Already translated. */
  readonly label: string;
  /** Each part of the screen has its own address, so Back, a refresh and a shared link land on it. */
  readonly href: string;
}

export interface TabsProps {
  /** Names the tabs' navigation landmark, for example "Tournaments". */
  label: string;
  tabs: readonly TabItem[];
  /** The id of the part shown. */
  current: string;
  onNavigate?: Navigate | undefined;
}

/**
 * The parts of one screen, such as a tournament's list, templates and structures (#603): links that mark the part
 * shown, in a row that scrolls sideways on a phone rather than wrapping.
 */
export function Tabs({ label, tabs, current, onNavigate }: TabsProps) {
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <ul className="flex min-w-max gap-2 border-b border-hairline">
        {tabs.map((tab) => {
          const isCurrent = tab.id === current;
          return (
            <li key={tab.id}>
              <a href={tab.href} aria-current={isCurrent ? 'page' : undefined} onClick={(event) => routeClick(event, tab.href, onNavigate)}
                className={cx(
                  '-mb-px flex min-h-touch items-center border-b-2 px-3 font-text text-16 transition-colors focus-visible:outline-2 focus-visible:outline-focus',
                  isCurrent ? 'border-action font-medium text-content' : 'border-transparent text-content-muted hover:text-content',
                )}>
                {tab.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
