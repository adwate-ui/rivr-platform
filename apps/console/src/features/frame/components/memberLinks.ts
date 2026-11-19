import type { Permission } from '@rivr/contracts';
import type { MemberLinks } from '@rivr/ui';
import { isAllowedAt } from './rail.ts';

/**
 * Where a member's name leads on the console (owner, 19 Nov): their account on Members, `/members?member=…`, for staff
 * who read members and open Members, as the search finds them; for anyone else nowhere, so the name is plain text.
 */
export function memberLinksFor(permissions: readonly Permission[], onNavigate: (href: string) => void): MemberLinks {
  const canOpen = permissions.includes('members.read') && isAllowedAt(permissions, '/members');
  return { hrefOf: (memberId) => (canOpen ? `/members?member=${encodeURIComponent(memberId)}` : undefined), onNavigate };
}
