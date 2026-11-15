import { cx } from './classes.ts';

/** A row of a TV list: what leads it (a place, or where a seat is), the name, and a figure at the right in gold. */
export interface TvRowProps {
  lead: string;
  /** The lead is words ("Table 1 · seat 3"), a third of the row wide, where a place number takes 64 px. */
  isWide?: boolean | undefined;
  name: string;
  value: string;
}

// Heights at 1920 by 1080. A row: the name's line (62), 16 above and below, and its hairline; with the figure under the
// name, the figure's line (52) more. The "+N more" line: 12 above its 36.
export const TV_ROW_HEIGHT = 96;
export const TV_ROW_STACKED_HEIGHT = 148;
export const TV_MORE_HEIGHT = 48;

// A character's width on average: a name at 48 px semibold, a figure at 40 px. The gap either side of the name is 24.
const NAME_CHAR = 25;
const VALUE_CHAR = 20;
const GAP = 24;
const PLACE_WIDTH = 64;

/**
 * A row's height in a list `width` px wide. The browser sets the figure under the name where the two do not fit one line
 * (TvRow), so the name is not cut; a list counts such a row at its taller height, by the lengths of the two.
 */
export function tvRowHeight(row: Pick<TvRowProps, 'isWide' | 'name' | 'value'>, width: number): number {
  const lead = row.isWide === true ? width / 3 : PLACE_WIDTH;
  const isStacked = row.name.length * NAME_CHAR + row.value.length * VALUE_CHAR > width - lead - 2 * GAP;
  return isStacked ? TV_ROW_STACKED_HEIGHT : TV_ROW_HEIGHT;
}

/** How many rows of these heights the room holds: all of them, or as many as leave room for the "+N more" line. */
export function tvRowsThatFit(heights: readonly number[], room: number): number {
  if (heights.reduce((sum, height) => sum + height, 0) <= room) return heights.length;
  let used = TV_MORE_HEIGHT;
  let count = 0;
  for (const height of heights) {
    used += height;
    if (used > room) break;
    count += 1;
  }
  return count;
}

/**
 * One row of a TV list (redesign RD-28): the lead muted, the name large, the figure in gold at the right. The name keeps its
 * whole width: a lead of words wraps onto two lines, and the figure goes under the name, before the name is cut (correction 34).
 */
export function TvRow({ lead, isWide = false, name, value }: TvRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-x-6 border-b border-hairline py-4">
      <span className={cx('shrink-0 font-text text-28 leading-tight text-content-muted', isWide ? 'w-1/3' : 'w-16 tabular-nums')}>{lead}</span>
      <span className="max-w-full shrink-0 truncate font-text text-48 font-semibold leading-snug text-content">{name === '' ? <>&nbsp;</> : name}</span>
      <span className="ml-auto shrink-0 whitespace-nowrap font-text text-40 leading-snug tabular-nums text-money">{value}</span>
    </li>
  );
}

/** Under a list cut short: "+3 more". */
export function TvMore({ hidden, moreText }: { hidden: number; moreText: ((hidden: number) => string) | undefined }) {
  return hidden > 0 && moreText !== undefined ? <p className="pt-3 font-text text-28 leading-snug text-content-muted">{moreText(hidden)}</p> : null;
}

/** What a board says with nothing to show: "No one waiting." */
export function TvEmpty({ text }: { text: string }) {
  return <p className="font-text text-36 leading-snug text-content-muted">{text}</p>;
}
