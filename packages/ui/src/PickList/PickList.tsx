import { useId, type ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { MemberLink } from '../MemberLink/MemberLink.tsx';
import { Text } from '../Text/Text.tsx';

/** One item to open: its title and, under it, one line. */
export interface PickListItem {
  readonly id: string;
  /** Already translated: a member's name, a page's name. */
  readonly title: string;
  /** One muted line under the title: "PAN alone · 11:42". */
  readonly detail?: string | undefined;
  /** The member the title names: it is then their `MemberLink`, above the item's own button (owner, 19 Nov). */
  readonly memberId?: string | undefined;
}

/** Items under a heading, such as To review; a list of one kind needs none. */
export interface PickListGroup {
  readonly label?: string | undefined;
  /** How many the group holds in all, at the heading's end. */
  readonly count?: number | undefined;
  readonly items: readonly PickListItem[];
}

export interface PickListProps {
  /** What the list holds, read as its name: "Lapsed regulars". */
  label: string;
  groups: readonly PickListGroup[];
  /** The id of the item open beside the list, or null while none is. */
  current: string | null;
  onPick: (id: string) => void;
  /** Above the items, such as a search field. */
  search?: ReactNode;
  /** One line when no group holds an item: "No page matches." */
  emptyText: string;
}


const ITEM_LOOK = 'flex min-h-touch w-full flex-col items-start justify-center gap-1 border-l-2 px-4 text-left transition-colors tablet:min-h-control';
const ITEM_FOCUS = 'focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-focus';
const fillOf = (isCurrent: boolean) => (isCurrent ? 'border-content bg-selected' : 'border-transparent hover:bg-subtle');

function Item({ item, isCurrent, onPick }: { item: PickListItem; isCurrent: boolean; onPick: (id: string) => void }) {
  if (item.memberId !== undefined) return <MemberItem item={item} memberId={item.memberId} isCurrent={isCurrent} onPick={onPick} />;
  return (
    <li>
      <button type="button" aria-current={isCurrent ? 'true' : undefined} onClick={() => onPick(item.id)}
        className={cx(ITEM_LOOK, item.detail ? 'py-3' : 'py-2', ITEM_FOCUS, fillOf(isCurrent))}>
        <span className="font-text text-14 leading-snug font-medium text-content">{item.title}</span>
        {item.detail ? <span className="font-text text-12 leading-snug text-content-muted">{item.detail}</span> : null}
      </button>
    </li>
  );
}

/**
 * An item naming a member: the item's button covers it, named with its title and line as the plain item is, and the name
 * above it is the member's link (owner, 19 Nov), so a click on the name opens their account and anywhere else the item.
 */
function MemberItem({ item, memberId, isCurrent, onPick }: { item: PickListItem; memberId: string; isCurrent: boolean; onPick: (id: string) => void }) {
  return (
    // Clipped, so a short item's name link keeps its 44 px press inside the item and never over the next one's.
    <li className="relative isolate overflow-clip">
      <button type="button" aria-current={isCurrent ? 'true' : undefined} onClick={() => onPick(item.id)}
        aria-label={[item.title, item.detail].filter(Boolean).join(' ')}
        className={cx('absolute inset-0 border-l-2 transition-colors', ITEM_FOCUS, fillOf(isCurrent))} />
      {/* The plain item's look, with its edge kept clear, so the words sit where they do there. */}
      <div className={cx('pointer-events-none relative', ITEM_LOOK, item.detail ? 'py-3' : 'py-2', 'border-transparent')}>
        <span className="font-text text-14 leading-snug font-medium text-content"><MemberLink memberId={memberId}>{item.title}</MemberLink></span>
        {item.detail ? <span aria-hidden="true" className="font-text text-12 leading-snug text-content-muted">{item.detail}</span> : null}
      </div>
    </li>
  );
}

function Group({ group, current, onPick }: { group: PickListGroup; current: string | null; onPick: (id: string) => void }) {
  const headingId = useId();
  return (
    <div>
      {group.label === undefined ? null : (
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
          <h2 id={headingId}><Text as="span" variant="eyebrow" tone="muted">{group.label}</Text></h2>
          {group.count === undefined ? null : <Text as="span" variant="eyebrow" tone="muted" isTabular>{group.count}</Text>}
        </div>
      )}
      <ul aria-labelledby={group.label === undefined ? undefined : headingId} className="flex flex-col">
        {group.items.map((item) => <Item key={item.id} item={item} isCurrent={item.id === current} onPick={onPick} />)}
      </ul>
    </div>
  );
}

/**
 * A queue to open items from, beside the item open (console v3: KYC review, Host queue, the website's pages): on a raised
 * panel, each group under its heading and count, each item a row of its title and one line; the one open on the chosen
 * fill with a cream edge (gold is only for what needs someone, decision 0463). A search field, given, sits above.
 */
export function PickList({ label, groups, current, onPick, search, emptyText }: PickListProps) {
  const isEmpty = groups.every((group) => group.items.length === 0);
  return (
    <section aria-label={label} className="flex flex-col overflow-hidden rounded-md bg-raised text-content">
      {search === undefined ? null : <div className="p-2">{search}</div>}
      {isEmpty ? <p className="px-4 py-4 font-text text-14 leading-normal text-content-muted">{emptyText}</p> : null}
      {groups.filter((group) => group.items.length > 0).map((group, index) => (
        <Group key={group.label ?? String(index)} group={group} current={current} onPick={onPick} />
      ))}
    </section>
  );
}
