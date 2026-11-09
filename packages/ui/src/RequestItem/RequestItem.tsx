import { t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
import { Button } from '../Button/Button.tsx';
import { cx } from '../internal/classes.ts';

/** How long a new request's gold tint takes to fade, from the tokens: 2.5 s (decision 0465). Keep `isNew` on for as long. */
export const FRESH_MS = Number.parseInt(String(tokens.motion.duration.fresh), 10);

/** One of a request's two actions: what it says and what it does. */
export interface RequestAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly isLoading?: boolean | undefined;
}

export interface RequestItemProps {
  /** What is asked: "Join request", "Top-up", "Wants +1 h". The queue's line; `look="ask"` draws none. */
  kind?: string | undefined;
  /** How long it has waited: "4 min". */
  age?: string | undefined;
  /** It has waited past its target: "Late · 130 min", the word first and the danger colour second (WCAG 1.4.1). */
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
  /** Just arrived: a gold tint that fades over 2.5 s (decision 0465). */
  isNew?: boolean;
  /** The screen's key for this request, kept on it as `data-request`, so the floor's A and D find the one in focus. */
  requestKey?: string | undefined;
  /**
   * `queue`, an entry in the floor's list of requests. `ask`, what one player asks, inside their sheet: a gold-tinted box
   * (it needs the floor, decision 0463) with the ask and its age on one line and the actions under it; `kind` and `detail`
   * are the sheet's to say.
   */
  look?: 'queue' | 'ask';
}

/** Who asks: words, or a button that opens them when `onTitle` is given. */
function Title({ title, onTitle }: Pick<RequestItemProps, 'title' | 'onTitle'>) {
  const look = 'font-text text-15 leading-snug font-medium text-content';
  if (onTitle === undefined) return <p className={look}>{title}</p>;
  return (
    <button type="button" onClick={onTitle}
      className={cx(look, 'self-start text-start underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-focus')}>
      {title}
    </button>
  );
}

/** How long it has waited; past its target, "Late · 130 min" in the danger colour, so the word tells it without the colour. */
function Age({ age, isLate }: { age: string | undefined; isLate: boolean }) {
  if (age === undefined) return null;
  return (
    <span className={cx('shrink-0 font-text text-12 leading-snug tabular-nums', isLate ? 'font-semibold text-danger' : 'text-content-muted')}>
      {isLate ? t('ui.console.requestItem.late', { age }) : age}
    </span>
  );
}

/** The one filled action and the one in words: small in the queue, the console's compact height in a sheet. */
function Actions({ primary, secondary, size }: Pick<RequestItemProps, 'primary' | 'secondary'> & { size: 'small' | 'compact' }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="strong" size={size} isLoading={primary.isLoading === true} onClick={primary.onClick}>{primary.label}</Button>
      {secondary ? <Button variant="text" size={size} isLoading={secondary.isLoading === true} onClick={secondary.onClick}>{secondary.label}</Button> : null}
    </div>
  );
}

/** What one player asks, in their sheet: the gold dot and the ask, its age, then the actions. */
function Ask({ age, isLate = false, title, primary, secondary }: RequestItemProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-selected p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 font-text text-15 leading-snug font-semibold text-content">
          <span aria-hidden="true" className="size-pip shrink-0 rounded-full bg-action" />
          {title}
        </p>
        <Age age={age} isLate={isLate} />
      </div>
      <Actions primary={primary} secondary={secondary} size="compact" />
    </div>
  );
}

/**
 * One request in the console's queue (console v3): what is asked and how long ago, past its target in the danger colour;
 * who asks and where; then one filled action and one in words. A new one shows in a gold tint that fades. `look="ask"`
 * is the same request inside the player's own sheet.
 */
export function RequestItem(props: RequestItemProps) {
  const { kind, age, isLate = false, title, onTitle, detail, primary, secondary, isNew = false, requestKey } = props;
  if (props.look === 'ask') return <Ask {...props} />;
  return (
    <div data-fresh={isNew ? '' : undefined} data-request={requestKey} className="-mx-3 flex flex-col gap-1 rounded-md px-3 py-3">
      <div className="flex items-center justify-between gap-2 font-text text-12 leading-snug">
        <span className="text-content-muted">{kind}</span>
        <Age age={age} isLate={isLate} />
      </div>
      <Title title={title} onTitle={onTitle} />
      {detail ? <p className="font-text text-13 leading-snug text-content-muted">{detail}</p> : null}
      <div className="mt-2"><Actions primary={primary} secondary={secondary} size="small" /></div>
    </div>
  );
}
