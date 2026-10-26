import type { PlayLevel, Stage } from './stages.ts';
import { MOST_STAGES } from './stages.ts';

/** What the floor asks of the blind-structure calculator. Chips and minutes are whole numbers. */
export interface StructurePlan {
  readonly startingStack: number;
  /** The entries expected, re-entries included: with the stack, the chips in play at the end. */
  readonly expectedEntries: number;
  /** The first level's big blind, at least 100 chips; rounded to the chip ladder. */
  readonly firstBigBlind: number;
  readonly levelMinutes: number;
  /** How long the tournament should run, breaks included. */
  readonly targetMinutes: number;
  /** A break after every this many levels; 0 for none. */
  readonly breakEvery: number;
  readonly breakMinutes: number;
  /** A big-blind ante at every level. */
  readonly hasAnte: boolean;
}

// Big blinds come off this ladder (100, 120, 150, 200 ... 800, 1,000, 1,200 ...), so each halves into a whole small blind.
const LADDER_STEPS = [100, 120, 150, 200, 250, 300, 400, 500, 600, 800] as const;
// By the target length the last level's big blind is a twentieth of the chips in play: two players left hold ten each.
const FINAL_BIG_BLINDS = 20;

/** The ladder's value at `rung`: rung 0 is 100, rung 10 is 1,000, rung 20 is 10,000. */
function ladderValue(rung: number): number {
  const step = LADDER_STEPS[rung % LADDER_STEPS.length] ?? 100;
  return step * 10 ** Math.floor(rung / LADDER_STEPS.length);
}

/** The rung whose value is nearest `chips` by ratio (a tie takes the lower rung), never below 100. */
function nearestRung(chips: number): number {
  let rung = 0;
  while (Math.abs(Math.log(ladderValue(rung + 1) / chips)) < Math.abs(Math.log(ladderValue(rung) / chips))) rung += 1;
  return rung;
}

/** How many breaks a run of `levels` levels gets: one after every `every` levels, never after the last. */
function breaksFor(levels: number, every: number): number {
  return every > 0 ? Math.floor((levels - 1) / every) : 0;
}

/** The most levels that fit the target length with their breaks, at least one and within sixty stages. */
function levelsThatFit(plan: StructurePlan): number {
  let levels = 1;
  const fits = (count: number) => count * plan.levelMinutes + breaksFor(count, plan.breakEvery) * plan.breakMinutes <= plan.targetMinutes
    && count + breaksFor(count, plan.breakEvery) <= MOST_STAGES;
  while (fits(levels + 1)) levels += 1;
  return levels;
}

/** Each level's big blind: rising evenly by ratio from the first to the last, on the ladder, each above the one before. */
function bigBlinds(plan: StructurePlan, levels: number): number[] {
  const first = nearestRung(plan.firstBigBlind);
  const last = nearestRung((plan.startingStack * plan.expectedEntries) / FINAL_BIG_BLINDS);
  const rungs: number[] = [];
  for (let index = 0; index < levels; index += 1) {
    const even = levels === 1 ? first : Math.round(first + ((last - first) * index) / (levels - 1));
    rungs.push(Math.max(even, (rungs.at(-1) ?? first - 1) + 1));
  }
  return rungs.map(ladderValue);
}

/**
 * A blind structure for a target length (#115, decision 0200): as many levels of `levelMinutes` as fit,
 * with a break after every `breakEvery` levels, the big blind climbing the chip ladder evenly from the
 * first level's to a twentieth of the chips in play, the small blind half the big, and a big-blind
 * ante when asked. Every level's blinds are above the last one's. The floor may change any level after.
 */
export function planStructure(plan: StructurePlan): Stage[] {
  const levels = levelsThatFit(plan);
  const stages: Stage[] = [];
  for (const [index, bigBlind] of bigBlinds(plan, levels).entries()) {
    const level: PlayLevel = { kind: 'level', smallBlind: bigBlind / 2, bigBlind, ante: plan.hasAnte ? bigBlind : 0, minutes: plan.levelMinutes };
    stages.push(level);
    const isBreakDue = plan.breakEvery > 0 && (index + 1) % plan.breakEvery === 0 && index + 1 < levels;
    if (isBreakDue) stages.push({ kind: 'break', minutes: plan.breakMinutes });
  }
  return stages;
}
