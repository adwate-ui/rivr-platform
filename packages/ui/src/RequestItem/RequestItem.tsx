import { t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { cx } from '../internal/classes.ts';

/** One of a request's two actions: what it says and what it does. */
export interface RequestAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly isLoading?: boolean | undefined;
}

export interface RequestItemProps {
  /** What is asked: "Join request", "Top-up", "Wants +1 h". */
  kind: string;
  /** How long it has waited: "4 min". */
  age?: string | undefined;
  /** It has waited past its target: the age in the danger colour, and "late" read after it. */
  isLate?: boolean;
  /** Who asks: "Ritika Bhalla". */
  title: string;
  /** Opens who asks, their seat or their record; the title is then a button. */
  onTitle?: (() => void) | undefined;
  /** Where: "Table 1 waitlist", "Table 2, seat 5". */
  detail?: string | undefined;
  /** The one filled action: Approve, Start, Seat. */
  primary: RequestAction;
  /** The other, in words: Decline, Not leaving. */
  secondary?: RequestAction | undefined;
  /** Just arrived: a gold tint that fades over 2.5 s (decision 0431). */
  isNew?: boolean;
}

/** Who asks: words, or a button that opens them when `onTitle` is given. */
function Title({ title, onTitle }: Pick<RequestItemProps, 'title' | 'onTitle'>) {
  const look = 'font-text text-15 leading-snug font-medium text-content';
  if (onTitle === undefined) return <p className={look}>{title}</p>;
  return (
    <button type="button" onClick={onTitle}
      className={cx(look, 'self-start text-start underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus')}>
      {title}
    </button>
  );
}

/**
 * One request in the console's queue (console v3): what is asked and how long ago, past its target in the danger colour;
 * who asks and where; then one filled action and one in words. A new one shows in a gold tint that fades.
 */
export function RequestItem({ kind, age, isLate = false, title, onTitle, detail, primary, secondary, isNew = false }: RequestItemProps) {
  return (
    <div data-fresh={isNew ? '' : undefined} className="-mx-3 flex flex-col gap-1 rounded-md px-3 py-3">
      <div className="flex items-center justify-between gap-2 font-text text-12 leading-snug">
        <span className="text-content-muted">{kind}</span>
        {age === undefined ? null : (
          <span className={cx('shrink-0 tabular-nums', isLate ? 'text-danger' : 'text-content-muted')}>
            {age}
            {isLate ? <span className="sr-only">, {t('ui.console.requestItem.late')}</span> : null}
          </span>
        )}
      </div>
      <Title title={title} onTitle={onTitle} />
      {detail ? <p className="font-text text-13 leading-snug text-content-muted">{detail}</p> : null}
      <div className="mt-2 flex items-center gap-1">
        <Button variant="strong" size="small" isLoading={primary.isLoading === true} onClick={primary.onClick}>{primary.label}</Button>
        {secondary ? <Button variant="text" size="small" isLoading={secondary.isLoading === true} onClick={secondary.onClick}>{secondary.label}</Button> : null}
      </div>
    </div>
  );
}
