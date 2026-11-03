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
  /** The ⋯ menu after it: Hold place, Release, Remove from list. */
  menu?: { readonly label: string; readonly items: readonly OverflowMenuItem[] } | undefined;
  /** The staff member's density (console v3): 42 px rows, or 34 px compact, at a desk. */
  density?: 'comfortable' | 'compact';
}

/**
 * One place on a table's waitlist in the console (console v3): its tick, its number, who and how long, then Seat and the ⋯
 * menu. 44 px below 1180 px, and 42 or 34 px at a desk by the staff member's density; everything centred down the row.
 */
export function WaitlistRow({ position, name, meta, isHeld = false, tick, action, menu, density = 'comfortable' }: WaitlistRowProps) {
  return (
    <div className={cx('flex min-h-touch items-center gap-3 px-4', density === 'compact' ? 'tablet:min-h-row-compact' : 'tablet:min-h-row')}>
      {tick === undefined ? null : <Tick label={tick.label} isChecked={tick.isTicked} isMixed={false} onChange={tick.onToggle} />}
      <span className="w-5 shrink-0 font-text text-13 text-content-muted tabular-nums">{position}</span>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <span className={cx('truncate font-text text-14 leading-snug', isHeld ? 'text-content-muted' : 'text-content')}>{name}</span>
        {meta === undefined ? null : <span className="truncate font-text text-12 leading-snug text-content-muted">{meta}</span>}
      </div>
      {action === undefined ? null : (
        <Button variant="subtle" size="small" aria-label={action.name} isLoading={action.isLoading === true} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {menu === undefined ? null : <OverflowMenu label={menu.label} items={menu.items} />}
    </div>
  );
}
