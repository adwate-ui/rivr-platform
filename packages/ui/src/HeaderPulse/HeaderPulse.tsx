import { routeClick, type Navigate } from '../internal/navigation.ts';

/** One count in the pulse: how many, what of, and the screen it opens. */
export interface PulseCount {
  readonly id: string;
  readonly count: number;
  /** What is counted, after the number: "seated", "waiting", "requests". */
  readonly label: string;
  readonly href: string;
  /** The count asks for the staff member (requests): a gold dot before it while it is above 0 (decision 0463). */
  readonly needsYou?: boolean | undefined;
}

export interface HeaderPulseProps {
  /** Names the counts for a screen reader: "Tonight". */
  label: string;
  items: readonly PulseCount[];
  onNavigate?: Navigate | undefined;
}

/**
 * The night at a glance in the console's header (console v3): "23 seated · 9 waiting · 6 requests", each count a link
 * to its screen, the number in cream and its word muted. A count that needs the staff member carries a gold dot while
 * it is above 0; its word says what it is, so the dot is never the only sign.
 */
export function HeaderPulse({ label, items, onNavigate }: HeaderPulseProps) {
  return (
    <nav aria-label={label}>
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex">
            <a href={item.href} onClick={(event) => routeClick(event, item.href, onNavigate)}
              className="flex min-h-touch items-center gap-2 rounded-md px-3 font-text text-13 leading-control whitespace-nowrap text-content-muted transition-colors hover:bg-subtle hover:text-content focus-visible:outline focus-visible:outline-focus tablet:min-h-8">
              {item.needsYou === true && item.count > 0 ? <span aria-hidden="true" className="size-pip shrink-0 rounded-full bg-action" /> : null}
              <span><span className="font-semibold text-content tabular-nums">{item.count}</span> {item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
