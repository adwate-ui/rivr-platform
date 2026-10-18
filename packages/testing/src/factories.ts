import { indianMobileSchema } from '@rivr/contracts';
import { newId } from './ids.ts';
import { paise } from './paise.ts';
import { designPromptSeed, STAKES_100_200 } from './seed/index.ts';
import type { SeedMember, SeedTable, SeedVenue, SeedWaitlistEntry } from './seed/types.ts';

// Each factory fills every field with a sensible default, so a test names only what it is about.

let phonesIssued = 0;

/** A real (not practice) venue with a fresh id. */
export function buildVenue(overrides: Partial<SeedVenue> = {}): SeedVenue {
  return { id: newId.venue(), name: 'Test venue', isPractice: false, ...overrides };
}

/** An open, empty 100/200 table with the ₹10,000 tables' rules, in the seed venue. */
export function buildTable(overrides: Partial<SeedTable> = {}): SeedTable {
  return {
    id: newId.table(),
    venueId: designPromptSeed.venue.id,
    name: 'Test table',
    game: 'NLH + variation',
    stakes: STAKES_100_200,
    straddle: null,
    buyIn: paise(1_000_000n), // ₹10,000
    rakeBasisPoints: 500n,
    rakeCap: paise(600_000n), // ₹6,000
    seats: 9,
    seated: 0,
    isOpen: true,
    ...overrides,
  };
}

/** A member on the base tier with their own fictional phone number, in the seed venue. */
export function buildMember(overrides: Partial<SeedMember> = {}): SeedMember {
  phonesIssued += 1;
  return {
    id: newId.member(),
    venueId: designPromptSeed.venue.id,
    name: 'Test member',
    phone: indianMobileSchema.parse(`+9198${String(phonesIssued).padStart(8, '0')}`),
    tier: 'member',
    qualifyingStakes: null,
    ...overrides,
  };
}

/** A new member on the 100/200 waitlist, joined at the seed clock. */
export function buildWaitlistEntry(overrides: Partial<SeedWaitlistEntry> = {}): SeedWaitlistEntry {
  return { memberId: newId.member(), stakes: STAKES_100_200, joinedAt: designPromptSeed.clock, ...overrides };
}
