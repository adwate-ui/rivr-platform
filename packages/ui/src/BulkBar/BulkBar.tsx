import { t } from '@rivr/i18n';
import { Icon } from '../Icon/Icon.tsx';
import { cx } from '../internal/classes.ts';

export interface BulkBarAction {
  readonly id: string;
  /** Already translated, a verb: "Hold", "Remove". */
  readonly label: string;
  readonly onClick: () => void;
  /** The bar's one main action, filled in ink; the rest are words. */
  readonly isMain?: boolean | undefined;
  /** `danger`, a step that removes or ends something: in the alert red, filled when it is the main one. */
  readonly tone?: 'danger' | undefined;
  /** Shows a turning circle beside its label and ignores presses while the step is in flight. */
  readonly isLoading?: boolean | undefined;
}

export interface BulkBarProps {
  /** How many rows are ticked. At 0 nothing shows, but the count's live region stays, so the first tick is announced. */
  count: number;
  /** In the order shown, after the count. */
  actions: readonly BulkBarAction[];
  /** Unticks every row. */
  onClear: () => void;
}

// The bar's place, kept while none is ticked as an empty band of its height, so ticking the first row or clearing the last
// moves nothing under it (the list's rows would otherwise shift under the pointer). Only the shown bar stays at the top.
const PLACE = 'flex flex-wrap items-center gap-2 px-4 py-2';
const BAR = 'sticky top-0 z-nav rounded-lg bg-cream text-on-cream';

// The ring is ink, as the focus colour is cream; set off from the ink-filled action so the two never merge.
const ACTION =
  'inline-flex min-h-touch items-center justify-center gap-2 rounded-md px-3 font-text text-13 leading-control font-medium select-none ' +
  'transition-colors underline-offset-4 tablet:min-h-8 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ' +
  'aria-busy:cursor-progress';

/** On the cream bar: the main action filled, ink or alert red; the rest words, ink or red, underlined under the pointer. */
function lookOf({ isMain, tone }: BulkBarAction): string {
  if (isMain) return tone === 'danger' ? 'bg-alert text-on-alert' : 'bg-ink text-cream';
  return tone === 'danger' ? 'text-alert hover:underline' : 'text-on-cream hover:underline';
}

function BarAction({ action }: { action: BulkBarAction }) {
  const busy = action.isLoading ? true : undefined;
  return (
    <button type="button" aria-busy={busy} aria-disabled={busy} onClick={() => { if (!action.isLoading) action.onClick(); }}
      className={cx(ACTION, lookOf(action))}>
      {action.isLoading ? <span className="inline-flex" data-busy-turn="" aria-hidden="true"><Icon name="loading" size="sm" /></span> : null}
      {action.label}
    </button>
  );
}

/**
 * The bar over a list while rows are ticked (console v3): a cream bar that stays at the top as the list scrolls, with how
 * many are chosen, said politely as it changes, the actions on them, and Clear. Render it always, with `count` 0 when
 * none is ticked: its place is kept empty then, so the list under it does not move as rows are ticked.
 */
export function BulkBar({ count, actions, onClear }: BulkBarProps) {
  const isShown = count > 0;
  return (
    <div role={isShown ? 'region' : undefined} aria-label={isShown ? t('ui.console.bulkBar.label') : undefined} className={cx(PLACE, isShown && BAR)}>
      <span aria-live="polite" className="flex min-h-touch min-w-0 flex-1 items-center font-text text-14 leading-control font-semibold tablet:min-h-8">
        {isShown ? t('ui.console.bulkBar.selected', { count }) : null}
      </span>
      {isShown ? (
        <>
          {actions.map((action) => <BarAction key={action.id} action={action} />)}
          <button type="button" onClick={onClear} className={cx(ACTION, 'text-on-cream hover:underline')}>{t('ui.console.bulkBar.clear')}</button>
        </>
      ) : null}
    </div>
  );
}
