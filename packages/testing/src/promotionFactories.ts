import type { MemberFacts, PromotionEventJson, PromotionTerms } from '@rivr/contracts/promotionModel';

// Each factory fills every field with a sensible default, so a test names only what it is about.

/** Double points for everyone at every stake, every day, all day, from 1 November 2026, with no limits, on the app and the TVs. */
export function buildPromotionTerms(overrides: Partial<PromotionTerms> = {}): PromotionTerms {
  return {
    name: 'Double points',
    reward: { kind: 'points_multiplier', multiplier: 2 },
    eligibility: { stakes: 'all', tiers: 'all', audience: 'everyone' },
    schedule: { days: [1, 2, 3, 4, 5, 6, 7], from: '06:00', to: '06:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' },
    limits: { perMember: 'none' },
    channels: { playerApp: true, tv: true, website: false, whatsapp: false },
    rulesText: [],
    ...overrides,
  };
}

/** A regular on the base tier, a member for 200 days and last here a week ago, whose gender the club has not recorded. */
export function buildMemberFacts(overrides: Partial<MemberFacts> = {}): MemberFacts {
  return { tierId: 'tier-member', daysSinceJoined: 200, daysSinceLastVisit: 7, isWoman: null, ...overrides };
}

interface EventPlace {
  readonly key: string;
  readonly at: string;
  readonly memberId: string;
  readonly visitId: string | null;
  readonly tableId: string | null;
  readonly stake: string | null;
}

type EventFacts = PromotionEventJson extends infer E ? (E extends unknown ? Omit<E, keyof EventPlace> : never) : never;

/** An event of the kind its facts give, by member-1 on visit-1 at table-1 (50/100), at 21:00 IST on Tuesday 17 November 2026. */
export function buildPromotionEvent(facts: EventFacts, place: Partial<EventPlace> = {}): PromotionEventJson {
  return {
    key: 'event-1', at: '2026-11-17T21:00:00+05:30', memberId: 'member-1', visitId: 'visit-1', tableId: 'table-1', stake: 'nlh_50_100',
    ...place, ...facts,
  };
}
