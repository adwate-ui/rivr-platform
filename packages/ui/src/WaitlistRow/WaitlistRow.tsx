import { Button } from '../Button/Button.tsx';
import { Tick } from '../DataTable/Selection.tsx';
import { cx } from '../internal/classes.ts';
import { OverflowMenu, type OverflowMenuItem } from '../OverflowMenu/OverflowMenu.tsx';

/** The row's one action: what it says, the name it is read with, and what it does. */
export interface WaitlistRowAction {
  /** Already translated, a verb: "Seat". */
  readonly label: string;
  /** Read in place of the label, with who it acts on: "Seat Kabir Sethi". */
  readonly name: string;
  readonly onClick: () => void;
  readonly isLoading?: boolean | undefined;
}

export interface WaitlistRowProps {
  /** The place on the table's list, 1 first. */
  position: number;
  name: string;
  /** How long they have waited and anything to know: "5 min · added by the floor". */
  meta?: string | undefined;
  /** The place is held while the member is away: the name muted, and "place held" in the meta. */
  isHeld?: boolean;
  /** The tick for the bulk actions, read as "Select Kabir Sethi"; none leaves the row without one. */
  tick?: { readonly label: string; readonly isTicked: boolean; readonly onToggle: () => void } | undefined;
  /** The one action at the row's end: Seat. */
  action?: WaitlistRowAction | undefined;
  /** A second, before it: Call. */
  secondary?: WaitlistRowAction | undefined;
  /** Waited past the list's target: its line in the console's danger red, as `meta` also says in words (audit F-075). */
  isLate?: boolean;
  /** The ⋯ menu after it: Hold place, Release, Remove from list. */
  menu?: { readonly label: string; readonly items: readonly OverflowMenuItem[] } | undefined;
  /** The staff member's density (console v3): 42 px rows, or 34 px compact, at a desk. */
  density?: 'comfortable' | 'compact';
}

/** One of the row's actions, when it has it. */
function RowButton({ action }: { action: WaitlistRowAction | undefined }) {
  if (action === undefined) return null;
  return <Button variant="subtle" size="small" aria-label={action.name} isLoading={action.isLoading === true} onClick={action.onClick}>{action.label}</Button>;
}

/** The line under the name, which wraps rather than cutting off a call's deadline; in the danger red once late. */
function Meta({ meta, isLate }: { meta: string | undefined; isLate: boolean }) {
  if (meta === undefined) return null;
  return <span className={cx('font-text text-12 leading-snug', isLate ? 'font-semibold text-danger' : 'text-content-muted')}>{meta}</span>;
}

/**
 * One place on a table's waitlist in the console (console v3): its tick, its number, who and how long, then Seat and the ⋯
 * menu. 44 px below 1180 px, and 42 or 34 px at a desk by the staff member's density; everything centred down the row. Its
 * note wraps rather than cutting off a call's deadline (audit F-077).
 */
export function WaitlistRow({ position, name, meta, isLate = false, isHeld = false, tick, action, secondary, menu, density = 'comfortable' }: WaitlistRowProps) {
  return (
    <div className={cx('flex min-h-touch flex-wrap items-center gap-3 px-4', density === 'compact' ? 'tablet:min-h-row-compact' : 'tablet:min-h-row')}>
      {tick === undefined ? null : <Tick label={tick.label} isChecked={tick.isTicked} isMixed={false} onChange={tick.onToggle} />}
      <span className="w-5 shrink-0 font-text text-13 text-content-muted tabular-nums">{position}</span>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <span className={cx('truncate font-text text-14 leading-snug', isHeld ? 'text-content-muted' : 'text-content')}>{name}</span>
        <Meta meta={meta} isLate={isLate} />
      </div>
      {/* With two buttons the name has no room on a phone: they take a line of their own under it. */}
      <div className={cx('flex items-center gap-3', secondary !== undefined && 'max-medium:order-last max-medium:w-full max-medium:justify-end')}>
        <RowButton action={secondary} />
        <RowButton action={action} />
      </div>
      {menu === undefined ? null : <OverflowMenu label={menu.label} items={menu.items} />}
    </div>
  );
}
