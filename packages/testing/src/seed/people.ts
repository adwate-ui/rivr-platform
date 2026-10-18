import { indianMobileSchema, memberIdSchema, staffIdSchema, upiVpaSchema } from '@rivr/contracts';
import { paise } from '../paise.ts';
import { seedUuid, STAKES_100_200, tables, venue } from './tables.ts';
import { ist } from './time.ts';
import type { SeedDealerDown, SeedDemoMember, SeedMember, SeedStaff, SeedWaitlistEntry } from './types.ts';

// Fictional people with fictional numbers. Only adapter fakes ever see them.

/** A member with no balances, as the waitlist players are seeded. */
function member(index: number, name: string): SeedMember {
  return {
    id: memberIdSchema.parse(seedUuid(3, index)),
    venueId: venue.id,
    name,
    phone: indianMobileSchema.parse(`+9190000000${String(index).padStart(2, '0')}`),
    tier: 'member',
    qualifyingStakes: null,
  };
}

/** Arjun Mehta, the demo member: black card at 100/200, with every balance the flows touch. */
export const arjun: SeedDemoMember = {
  ...member(1, 'Arjun Mehta'),
  tier: 'black_card',
  qualifyingStakes: STAKES_100_200,
  cash: paise(18_500_000n), // ₹1,85,000
  bonus: { amount: paise(400_000n), expiresAt: ist('2026-11-22 23:59') }, // ₹4,000, expires Sunday
  openMarker: { amount: paise(5_000_000n), issuedAt: ist('2026-11-03 00:10') }, // ₹50,000, 14 days ago
  creditLimit: paise(20_000_000n), // ₹2,00,000
  points: 18_420,
  visitsThisMonth: 5,
  payoutAccount: { bankName: 'HDFC Bank', vpa: upiVpaSchema.parse('arjun.mehta@hdfcbank'), isVerified: true },
};

/** Everyone the seed names: Arjun and the three players on the 100/200 waitlist. */
export const members = {
  arjun,
  kabir: member(2, 'Kabir Sethi'),
  naina: member(3, 'Naina Kapoor'),
  rohan: member(4, 'Rohan Bhatia'),
} satisfies Record<string, SeedMember>;

/** The 100/200 waitlist in join order. The 50/100 list is empty. */
export const waitlist: readonly SeedWaitlistEntry[] = [
  { memberId: members.kabir.id, stakes: STAKES_100_200, joinedAt: ist('2026-11-16 23:52') },
  { memberId: members.naina.id, stakes: STAKES_100_200, joinedAt: ist('2026-11-16 23:58') },
  { memberId: members.rohan.id, stakes: STAKES_100_200, joinedAt: ist('2026-11-17 00:07') },
];

/** Pema Lepcha, the dealer on Table 3. */
export const dealer: SeedStaff = {
  id: staffIdSchema.parse(seedUuid(4, 1)),
  venueId: venue.id,
  name: 'Pema Lepcha',
  jobTitle: 'Dealer',
};

/** Pema's down on Table 3, started at 23:40. */
export const dealerDown: SeedDealerDown = {
  dealerId: dealer.id,
  tableId: tables.table3.id,
  startedAt: ist('2026-11-16 23:40'),
};
