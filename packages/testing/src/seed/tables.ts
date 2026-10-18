import { tableIdSchema, venueIdSchema } from '@rivr/contracts';
import { paise } from '../paise.ts';
import type { SeedTable, SeedVenue, Stakes } from './types.ts';

/** A fixed seed uuid, `5eed0002-0000-4000-8000-000000000003`, so seeded rows have the same ids everywhere. */
export function seedUuid(group: number, index: number): string {
  return `5eed${String(group).padStart(4, '0')}-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

/** RIVR Gurugram, the real venue. */
export const venue: SeedVenue = { id: venueIdSchema.parse(seedUuid(1, 1)), name: 'RIVR Gurugram', isPractice: false };

/** The practice venue: dummy money for staff training, never reaching an external system. */
export const practiceVenue: SeedVenue = {
  id: venueIdSchema.parse(seedUuid(1, 2)),
  name: 'RIVR practice',
  isPractice: true,
};

/** Blinds 50/100. */
export const STAKES_50_100: Stakes = { smallBlind: paise(5_000n), bigBlind: paise(10_000n) };
/** Blinds 100/200. */
export const STAKES_100_200: Stakes = { smallBlind: paise(10_000n), bigBlind: paise(20_000n) };

const RAKE_5_PERCENT = 500n;

/** A ₹10,000 NLH + variation table at 100/200, as Tables 2 to 5 are. */
function tenThousandTable(index: number, name: string, seating: { seated: number; isOpen: boolean }): SeedTable {
  return {
    id: tableIdSchema.parse(seedUuid(2, index)),
    venueId: venue.id,
    name,
    game: 'NLH + variation',
    stakes: STAKES_100_200,
    straddle: null,
    buyIn: paise(1_000_000n), // ₹10,000
    rakeBasisPoints: RAKE_5_PERCENT,
    rakeCap: paise(600_000n), // ₹6,000
    seats: 9,
    ...seating,
  };
}

/** The six tables of the design prompt and the 14 Oct additions, in floor order. */
export const tables = {
  table1: {
    id: tableIdSchema.parse(seedUuid(2, 1)),
    venueId: venue.id,
    name: 'Table 1',
    game: 'NLH',
    stakes: STAKES_50_100,
    straddle: null,
    buyIn: paise(500_000n), // ₹5,000
    rakeBasisPoints: RAKE_5_PERCENT,
    rakeCap: paise(300_000n), // ₹3,000
    seats: 9,
    seated: 6,
    isOpen: true,
  },
  table2: tenThousandTable(2, 'Table 2', { seated: 9, isOpen: true }),
  table3: tenThousandTable(3, 'Table 3', { seated: 8, isOpen: true }),
  table4: tenThousandTable(4, 'Table 4', { seated: 0, isOpen: false }),
  table5: tenThousandTable(5, 'Table 5', { seated: 0, isOpen: true }),
  privateRoom: {
    id: tableIdSchema.parse(seedUuid(2, 6)),
    venueId: venue.id,
    name: 'Private Room',
    game: 'NLH + ₹500 straddle',
    stakes: STAKES_100_200,
    straddle: paise(50_000n), // ₹500
    buyIn: paise(2_000_000n), // ₹20,000
    rakeBasisPoints: RAKE_5_PERCENT,
    rakeCap: paise(1_200_000n), // ₹12,000
    seats: 9,
    seated: 7,
    isOpen: true,
  },
} satisfies Record<string, SeedTable>;
