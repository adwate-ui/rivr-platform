import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { planStructure, type StructurePlan } from './calculator.ts';
import { clockAt, stageStartSeconds } from './clock.ts';
import { checkPurchase, TOURNAMENT_FORMATS, type EntryRules, type PlayerStanding, type Purchase } from './entry.ts';
import { balancingMoves, eligibleSeats, type TournamentSeat } from './seating.ts';
import { levelCount, structureMinutes, structureProblem, type Stage } from './stages.ts';

/** Any valid structure: a level first, then levels and single breaks, up to thirty stages. */
const level = fc.record({
  kind: fc.constant('level' as const), smallBlind: fc.integer({ min: 1, max: 500 }), bigBlind: fc.integer({ min: 500, max: 1_000 }),
  ante: fc.integer({ min: 0, max: 1_000 }), minutes: fc.integer({ min: 1, max: 120 }),
});
const pause = fc.record({ kind: fc.constant('break' as const), minutes: fc.integer({ min: 1, max: 120 }) });
const structure: fc.Arbitrary<Stage[]> = fc.tuple(level, fc.array(fc.tuple(fc.option(pause, { nil: undefined }), level), { maxLength: 14 }))
  .map(([first, rest]) => [first, ...rest.flatMap(([breakFirst, next]) => (breakFirst === undefined ? [next] : [breakFirst, next]))]);

const plan: fc.Arbitrary<StructurePlan> = fc.record({
  startingStack: fc.integer({ min: 1_000, max: 100_000 }), expectedEntries: fc.integer({ min: 2, max: 500 }),
  firstBigBlind: fc.integer({ min: 100, max: 2_000 }), levelMinutes: fc.integer({ min: 5, max: 60 }),
  targetMinutes: fc.integer({ min: 30, max: 900 }), breakEvery: fc.integer({ min: 0, max: 8 }),
  breakMinutes: fc.integer({ min: 5, max: 20 }), hasAnte: fc.boolean(),
});

describe('clockAt properties', () => {
  it('leaves between nothing and the whole stage', () => {
    fc.assert(fc.property(structure, fc.integer({ min: -600, max: 100_000 }), (stages, elapsed) => {
      const position = clockAt(stages, elapsed);
      const length = (stages[position.stage]?.minutes ?? 0) * 60;
      expect(position.secondsLeft).toBeGreaterThanOrEqual(0);
      expect(position.secondsLeft).toBeLessThanOrEqual(length);
    }));
  });

  it('accounts for every second: the stage’s start, plus what has gone of it, is the elapsed time', () => {
    fc.assert(fc.property(structure, fc.integer({ min: 0, max: 100_000 }), (stages, elapsed) => {
      const position = clockAt(stages, elapsed);
      const length = (stages[position.stage]?.minutes ?? 0) * 60;
      const total = structureMinutes(stages) * 60;
      expect(stageStartSeconds(stages, position.stage) + length - position.secondsLeft).toBe(Math.min(elapsed, total));
    }));
  });

  it('never goes back a level as time runs on, nor past the last', () => {
    fc.assert(fc.property(structure, fc.integer({ min: 0, max: 50_000 }), fc.integer({ min: 0, max: 50_000 }), (stages, a, b) => {
      const [earlier, later] = a <= b ? [a, b] : [b, a];
      expect(clockAt(stages, earlier).level).toBeLessThanOrEqual(clockAt(stages, later).level);
      expect(clockAt(stages, later).level).toBeLessThanOrEqual(levelCount(stages));
    }));
  });

  it('starts each stage in full at its own start', () => {
    fc.assert(fc.property(structure, fc.nat(), (stages, pick) => {
      const stage = pick % stages.length;
      const position = clockAt(stages, stageStartSeconds(stages, stage));
      expect(position.stage).toBe(stage);
      expect(position.secondsLeft).toBe((stages[stage]?.minutes ?? 0) * 60);
    }));
  });
});

describe('planStructure properties', () => {
  it('plans a structure the clock can run, never longer than the target unless one level is', () => {
    fc.assert(fc.property(plan, (asked) => {
      const stages = planStructure(asked);
      expect(structureProblem(stages)).toBeNull();
      if (levelCount(stages) > 1) expect(structureMinutes(stages)).toBeLessThanOrEqual(asked.targetMinutes);
    }));
  });

  it('raises the big blind every level, with half of it the small blind and the ante as asked', () => {
    fc.assert(fc.property(plan, (asked) => {
      const levels = planStructure(asked).filter((stage) => stage.kind === 'level');
      levels.forEach((each, index) => {
        expect(each.smallBlind * 2).toBe(each.bigBlind);
        expect(each.ante).toBe(asked.hasAnte ? each.bigBlind : 0);
        if (index > 0) expect(each.bigBlind).toBeGreaterThan(levels[index - 1]?.bigBlind ?? 0);
      });
    }));
  });
});

const rules: fc.Arbitrary<EntryRules> = fc.record({
  format: fc.constantFrom(...TOURNAMENT_FORMATS), lastRegistrationLevel: fc.integer({ min: 1, max: 12 }),
  maxBuys: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }), hasAddOn: fc.boolean(),
});
const player: fc.Arbitrary<PlayerStanding> = fc.record({ buys: fc.integer({ min: 0, max: 8 }), isAlive: fc.boolean(), hasTakenAddOn: fc.boolean() });
const purchase = fc.constantFrom<Purchase>('entry', 're_entry', 'rebuy', 'add_on');

describe('checkPurchase properties', () => {
  it('sells nothing but the add-on after registration closes', () => {
    fc.assert(fc.property(purchase, rules, player, fc.integer({ min: 1, max: 30 }), (asked, tournament, standing, after) => {
      const result = checkPurchase(asked, tournament, tournament.lastRegistrationLevel + after, standing);
      expect(result.ok).toBe(false);
    }));
  });

  it('sells a freezeout player one entry and at most the add-on', () => {
    fc.assert(fc.property(purchase, rules, player, fc.integer({ min: 0, max: 12 }), (asked, tournament, standing, clockLevel) => {
      const result = checkPurchase(asked, { ...tournament, format: 'freezeout' }, clockLevel, standing);
      if (result.ok) expect(['entry', 'add_on']).toContain(asked);
    }));
  });

  it('never sells a buy beyond the most buys', () => {
    fc.assert(fc.property(rules, player, fc.integer({ min: 0, max: 12 }), (tournament, standing, clockLevel) => {
      const buys = (['entry', 're_entry', 'rebuy'] as const).filter((asked) => checkPurchase(asked, tournament, clockLevel, standing).ok);
      if (tournament.maxBuys !== null && standing.buys >= tournament.maxBuys) expect(buys).toEqual([]);
    }));
  });
});

/** A room of up to six tables of up to ten seats, some of them taken. */
const room = fc.record({ tables: fc.integer({ min: 1, max: 6 }), seatsPerTable: fc.integer({ min: 2, max: 10 }) }).chain((size) =>
  fc.subarray(Array.from({ length: size.tables * size.seatsPerTable }, (_, index): TournamentSeat => ({
    table: Math.floor(index / size.seatsPerTable) + 1, seat: (index % size.seatsPerTable) + 1,
  }))).map((occupied) => ({ ...size, occupied })));

describe('seating properties', () => {
  it('offers only free seats, all at the emptiest tables with room, and none only when the room is full', () => {
    fc.assert(fc.property(room, ({ tables, seatsPerTable, occupied }) => {
      const offered = eligibleSeats(occupied, tables, seatsPerTable);
      const count = (table: number) => occupied.filter((taken) => taken.table === table).length;
      const withRoom = Array.from({ length: tables }, (_, index) => index + 1).filter((table) => count(table) < seatsPerTable);
      expect(offered.every((place) => !occupied.some((taken) => taken.table === place.table && taken.seat === place.seat))).toBe(true);
      expect(offered.every((place) => withRoom.every((table) => count(place.table) <= count(table)))).toBe(true);
      expect(offered.length === 0).toBe(occupied.length === tables * seatsPerTable);
    }));
  });

  it('balances any room to within one player, moving nobody in or out', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 1, maxLength: 8 }), (counts) => {
      const after = [...counts];
      for (const move of balancingMoves(counts)) {
        after[move.from - 1] = (after[move.from - 1] ?? 0) - 1;
        after[move.to - 1] = (after[move.to - 1] ?? 0) + 1;
      }
      expect(Math.max(...after) - Math.min(...after)).toBeLessThanOrEqual(1);
      expect(after.reduce((total, each) => total + each, 0)).toBe(counts.reduce((total, each) => total + each, 0));
    }));
  });
});
