/** The member record's parts, as tabs (C-02): visits, then the tier and a break, then the account's. */
export const RECORD_PARTS = ['visits', 'membership', 'account'] as const;
export type RecordPart = (typeof RECORD_PARTS)[number];

/** The parts a staff member may open: visits for all, the tier and a break with members.manage, the account's for super admins. */
export function partsFor(can: { manage: boolean; override: boolean; changePhone: boolean; erase: boolean }): readonly RecordPart[] {
  return RECORD_PARTS.filter((part) => {
    if (part === 'membership') return can.manage;
    if (part === 'account') return can.override || can.changePhone || can.erase;
    return true;
  });
}
