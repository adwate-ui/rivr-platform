import { createContext, use, type ReactNode } from 'react';
import { routeClick, type Navigate } from '../internal/navigation.ts';

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
 * it, underlined on hover. Plain text outside a `MemberLinksProvider`, or where it gives no address. It takes clicks even in
 * a tile whose content lets them through to the tile's own button beneath (`pointer-events-none`), so the name is the link
 * and the rest of the tile does what it did; it is never put inside a button. Its focus ring is drawn inside it, so a name
 * cut short in a row that truncates still shows it.
 */
export function MemberLink({ memberId, children }: MemberLinkProps) {
  const links = use(MemberLinksContext);
  const href = links?.hrefOf(memberId);
  if (links === null || href === undefined) return <>{children}</>;
  return (
    <a href={href} onClick={(event) => routeClick(event, href, links.onNavigate)}
      className="pointer-events-auto rounded-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-focus">
      {children}
    </a>
  );
}
