import type { IndianMobile, MemberId, Paise, StaffId, TableId, UpiVpa, VenueId } from '@rivr/contracts';

/** A member's tier as seeded; admins can add more. */
export type Tier = 'member' | 'academy_graduate' | 'founders_circle' | 'black_card';

/** A cash game's blinds in paise: 100/200 is 10,000/20,000. */
export interface Stakes {
  readonly smallBlind: Paise;
  readonly bigBlind: Paise;
}

/** A venue. The practice venue is a venue with dummy money. */
export interface SeedVenue {
  readonly id: VenueId;
  readonly name: string;
  readonly isPractice: boolean;
}

/** A table and its rules tonight. `rakeBasisPoints` 500 is 5%. */
export interface SeedTable {
  readonly id: TableId;
  readonly venueId: VenueId;
  readonly name: string;
  readonly game: string;
  readonly stakes: Stakes;
  readonly straddle: Paise | null;
  readonly buyIn: Paise;
  readonly rakeBasisPoints: bigint;
  readonly rakeCap: Paise;
  readonly seats: number;
  readonly seated: number;
  readonly isOpen: boolean;
}

/** A member. `qualifyingStakes` is set for a black card only. */
export interface SeedMember {
  readonly id: MemberId;
  readonly venueId: VenueId;
  readonly name: string;
  readonly phone: IndianMobile;
  readonly tier: Tier;
  readonly qualifyingStakes: Stakes | null;
}

/** The demo member with the balances the linked flows compute from. */
export interface SeedDemoMember extends SeedMember {
  readonly cash: Paise;
  readonly bonus: { readonly amount: Paise; readonly expiresAt: Date };
  readonly openMarker: { readonly amount: Paise; readonly issuedAt: Date };
  readonly creditLimit: Paise;
  readonly points: number;
  readonly visitsThisMonth: number;
  readonly payoutAccount: { readonly bankName: string; readonly vpa: UpiVpa; readonly isVerified: boolean };
}

/** A member waiting for a seat at a stake. */
export interface SeedWaitlistEntry {
  readonly memberId: MemberId;
  readonly stakes: Stakes;
  readonly joinedAt: Date;
}

/** A staff member; the job title is separate from the permission role. */
export interface SeedStaff {
  readonly id: StaffId;
  readonly venueId: VenueId;
  readonly name: string;
  readonly jobTitle: string;
}

/** A dealer's current shift at a table. */
export interface SeedDealerDown {
  readonly dealerId: StaffId;
  readonly tableId: TableId;
  readonly startedAt: Date;
}

/** Tonight's high hand. */
export interface SeedHighHand {
  readonly hand: string;
  readonly tableId: TableId;
  readonly at: Date;
  readonly prize: Paise;
}

/** A running tournament. Blinds and antes are tournament chips, not money. */
export interface SeedTournament {
  readonly name: string;
  readonly buyIn: Paise;
  readonly toPool: Paise;
  readonly fee: Paise;
  readonly reEntryUntilLevel: number;
  readonly levelMinutes: number;
  readonly level: number;
  readonly blinds: { readonly small: number; readonly big: number; readonly ante: number };
  readonly secondsLeftInLevel: number;
  readonly entries: number;
  readonly playersLeft: number;
  readonly pool: Paise;
  readonly guarantee: Paise;
  readonly placesPaid: number;
}

/** A live promotion, by kind. */
export type SeedPromotion =
  | {
      readonly kind: 'buy_in_bonus';
      readonly title: string;
      readonly weekday: 'tuesday';
      readonly bonusBasisPoints: bigint;
      readonly firstBuyInsPerTable: number;
    }
  | {
      readonly kind: 'high_hand';
      readonly title: string;
      readonly prizes: { readonly royalFlush: Paise; readonly straightFlush: Paise; readonly fourOfAKind: Paise };
    }
  | { readonly kind: 'referral'; readonly title: string; readonly rewardEachSide: Paise };
