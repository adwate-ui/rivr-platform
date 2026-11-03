import { t } from '@rivr/i18n';
import { useId, type ReactNode } from 'react';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

export interface DockedPanelProps {
  /** The screen beside the panel; it scrolls on its own, with the page's gutter. */
  children: ReactNode;
  /** The panel's name: "Requests". */
  title: string;
  /** How many the panel holds: beside its title, and on the strip when folded, gold while above 0 (decision 0463). */
  count: number;
  /** Open at 320 px, or folded to a 52 px strip with its count. */
  isOpen: boolean;
  /** Folds or opens the panel: its › while open, the whole strip while folded. */
  onToggle: () => void;
  /** What the panel holds while open: a live region, so what comes and goes is read out politely. */
  panel: ReactNode;
  /** The pointer came onto what the panel holds, or left it: a list there keeps still meanwhile (console v3). */
  onHoverChange?: ((isOver: boolean) => void) | undefined;
  /** False for a role the panel is not for: the screen alone, with the same gutter. */
  hasPanel?: boolean;
}

const TOGGLE =
  'flex size-touch shrink-0 items-center justify-center rounded-md text-content-muted transition-colors hover:bg-subtle hover:text-content ' +
  '-my-2 -mr-2 focus-visible:outline-2 focus-visible:outline-focus tablet:size-7';

/** The panel's count: gold with dark figures while something waits, faint and muted at none. */
function Count({ count }: { count: number }) {
  return (
    <span className={cx('flex h-6 min-w-6 items-center justify-center rounded-full px-2 font-text text-12 font-semibold tabular-nums',
      count > 0 ? 'bg-action text-on-action' : 'bg-subtle-hover text-content-muted')}>
      {count}
    </span>
  );
}

/**
 * A panel docked at the screen's right edge beside the screen itself (console v3): the Live floor's requests. Open, it is
 * 320 px with its title, count and › to fold it; folded, a 52 px strip with its count and its name read down the strip,
 * the whole strip opening it again. Below 768 px there is no panel: the phone gives it a screen of its own.
 */
export function DockedPanel({ children, title, count, isOpen, onToggle, panel, onHoverChange, hasPanel = true }: DockedPanelProps) {
  const headingId = useId();
  const screen = <div className="min-w-0 flex-1 overflow-y-auto px-4 pt-7 pb-10 medium:px-8">{children}</div>;
  if (!hasPanel) return <div className="flex h-full min-h-0">{screen}</div>;
  return (
    <div className="flex h-full min-h-0">
      {screen}
      <aside aria-labelledby={headingId} className={cx('hidden shrink-0 overflow-y-auto bg-raised medium:block', isOpen ? 'w-dock' : 'w-dock-strip')}>
        {isOpen ? (
          <div className="flex flex-col px-5 pt-7 pb-8">
            <div className="flex items-center gap-2 pb-3">
              <h2 id={headingId} className="min-w-0 flex-1 font-text text-15 leading-snug font-semibold">{title}</h2>
              <span className="font-text text-13 text-content-muted tabular-nums">{count}</span>
              <button type="button" aria-expanded="true" aria-label={t('ui.console.dockedPanel.fold')} onClick={onToggle} className={TOGGLE}>
                <Icon name="chevronRight" size="sm" />
              </button>
            </div>
            <div aria-live="polite" onPointerEnter={() => onHoverChange?.(true)} onPointerLeave={() => onHoverChange?.(false)}>{panel}</div>
          </div>
        ) : (
          <>
            <h2 id={headingId} className="sr-only">{title}</h2>
            <button type="button" aria-expanded="false" onClick={onToggle}
              className="flex min-h-full w-full flex-col items-center gap-3 pt-7 pb-7 transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus">
              <span className="sr-only">{t('ui.console.dockedPanel.open', { count })}</span>
              <span aria-hidden="true"><Count count={count} /></span>
              <span aria-hidden="true" data-vertical-label="" className="font-text text-13 text-content-muted">{title}</span>
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
