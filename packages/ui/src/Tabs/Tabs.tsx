import { cx } from '../internal/classes.ts';
import { routeClick, type Navigate } from '../internal/navigation.ts';

export interface TabItem {
  readonly id: string;
  /** Already translated. */
  readonly label: string;
  /** Each part of the screen has its own address, so Back, a refresh and a shared link land on it. */
  readonly href: string;
}

/**
 * `line`, words over a hairline, the part shown underlined; `pill`, the console's (console v3): no hairline, the part
 * shown on a faint cream fill, 32 px at a desk and 44 px below 1180 px.
 */
export type TabsLook = 'line' | 'pill';

export interface TabsProps {
  /** Names the tabs' navigation landmark, for example "Tournaments". */
  label: string;
  tabs: readonly TabItem[];
  /** The id of the part shown. */
  current: string;
  onNavigate?: Navigate | undefined;
  look?: TabsLook;
}

const ROW: Record<TabsLook, string> = { line: 'flex min-w-max gap-2 border-b border-hairline', pill: 'flex min-w-max gap-1' };

const LINK: Record<TabsLook, string> = {
  line: '-mb-px flex min-h-touch items-center border-b-2 px-3 font-text text-16 transition-colors focus-visible:outline-2 focus-visible:outline-focus',
  pill: 'flex min-h-touch items-center rounded-md px-3 font-text text-13 leading-control transition-colors tablet:min-h-8 focus-visible:outline-2 focus-visible:outline-focus',
};

// Muted words only on the page itself: the part shown, on its fill, is in cream.
const STATE: Record<TabsLook, { current: string; other: string }> = {
  line: { current: 'border-action font-medium text-content', other: 'border-transparent text-content-muted hover:text-content' },
  pill: { current: 'bg-subtle-hover font-medium text-content', other: 'text-content-muted hover:text-content' },
};

/**
 * The parts of one screen, such as a tournament's list, templates and structures (#603): links that mark the part
 * shown, in a row that scrolls sideways on a phone rather than wrapping.
 */
export function Tabs({ label, tabs, current, onNavigate, look = 'line' }: TabsProps) {
  return (
    <nav aria-label={label} className="overflow-x-auto">
      <ul className={ROW[look]}>
        {tabs.map((tab) => {
          const isCurrent = tab.id === current;
          return (
            <li key={tab.id}>
              <a href={tab.href} aria-current={isCurrent ? 'page' : undefined} onClick={(event) => routeClick(event, tab.href, onNavigate)}
                className={cx(LINK[look], isCurrent ? STATE[look].current : STATE[look].other)}>
                {tab.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
