import { createContext, use, type ReactNode } from 'react';
import { cx } from '../internal/classes.ts';
import { routeClick, type Navigate } from '../internal/navigation.ts';

// The link's press, 44 px tall and centred on its words below 1180 px, drawn by nothing: a row's own height is untouched.
const TOUCH_BAND = 'before:absolute before:inset-x-0 before:top-1/2 before:h-touch before:-translate-y-1/2 tablet:before:hidden';

/** Where a member's name leads: the app's address for their account, or undefined where the viewer may not open it. */
export interface MemberLinks {
  readonly hrefOf: (memberId: string) => string | undefined;
  readonly onNavigate?: Navigate | undefined;
}

const MemberLinksContext = createContext<MemberLinks | null>(null);

/** Makes every `MemberLink` inside a link, to the address `links.hrefOf` gives (the console's Members, owner 19 Nov). */
export function MemberLinksProvider({ links, children }: { links: MemberLinks; children: ReactNode }) {
  return <MemberLinksContext value={links}>{children}</MemberLinksContext>;
}

export interface MemberLinkProps {
  memberId: string;
  /** The member's name, as it shows. */
  children: string;
}

/**
 * A member's name that opens their account (owner, 19 Nov: every name in the console links to Members), in the type around
 * it. Always underlined, in the control colour and in full on hover, so it reads as a link without colour or a pointer,
 * in a run of words ("Table 1, seat 1 · Arjun Mehta") and in a table's column beside names that are not links alike
 * (WCAG 1.4.1). Below 1180 px its press reaches 44 px tall (decision 0282, WCAG 2.5.8) through an unseen band centred on
 * it, so no row grows for it. Plain text outside a `MemberLinksProvider`, or where it gives no address. It takes clicks
 * even in a tile whose content lets them through to the tile's own button beneath (`pointer-events-none`), so the name is
 * the link and the rest of the tile does what it did; it is never put inside a button. Its focus ring is drawn inside it,
 * so a name cut short in a row that truncates still shows it.
 */
export function MemberLink({ memberId, children }: MemberLinkProps) {
  const links = use(MemberLinksContext);
  const href = links?.hrefOf(memberId);
  if (links === null || href === undefined) return <>{children}</>;
  return (
    <a href={href} onClick={(event) => routeClick(event, href, links.onNavigate)}
      className={cx('pointer-events-auto relative rounded-sm underline decoration-control underline-offset-4 hover:decoration-current',
        'focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-focus', TOUCH_BAND)}>
      {children}
    </a>
  );
}
