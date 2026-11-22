/**
 * The member record's parts, one shown at a time (C-02): visits, then bonus chips (decision 0504), then what they told the
 * club at sign-up (owner, 8 Nov), then the tier and a break, then the account's.
 */
export const RECORD_PARTS = ['visits', 'bonus', 'signUp', 'membership', 'account'] as const;
export type RecordPart = (typeof RECORD_PARTS)[number];

/**
 * The parts a staff member may open: visits, bonus chips and sign-up for all; the tier and a break, and the account's, for
 * those who change them (members.manage; super admins) and, to view, for the floor and up (`viewsAll`, the owner, 22 Nov).
 */
export function partsFor(can: { manage: boolean; override: boolean; changePhone: boolean; erase: boolean; viewsAll: boolean }): readonly RecordPart[] {
  return RECORD_PARTS.filter((part) => {
    if (part === 'membership') return can.manage || can.viewsAll;
    if (part === 'account') return can.override || can.changePhone || can.erase || can.viewsAll;
    return true;
  });
}

/**
 * A member's record in the address (console v3): `/members?member=…`, and `&part=…` past the first part, so Back, a
 * refresh and a link from the floor open it.
 */
export function recordHref(memberId: string, part: RecordPart = 'visits'): string {
  const member = `/members?member=${encodeURIComponent(memberId)}`;
  return part === 'visits' ? member : `${member}&part=${part}`;
}
