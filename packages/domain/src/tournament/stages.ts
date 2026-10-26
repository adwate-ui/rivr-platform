/** A level of play: the small blind, big blind and ante in chips, played for so many minutes. */
export interface PlayLevel {
  readonly kind: 'level';
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly ante: number;
  readonly minutes: number;
}

/** A break between two levels, so many minutes long. */
export interface BreakStage {
  readonly kind: 'break';
  readonly minutes: number;
}

/** One stage of a blind structure, in the order the clock runs them: a level or a break. */
export type Stage = PlayLevel | BreakStage;

/** Why a blind structure cannot be run (decision 0200). */
export type StructureProblem = 'empty' | 'too_long' | 'break_first' | 'breaks_together' | 'minutes' | 'blinds';

/** A structure has at most sixty stages; a stage runs one to 120 minutes. */
export const MOST_STAGES = 60;
const MOST_MINUTES = 120;

const isWhole = (value: number, least: number) => Number.isSafeInteger(value) && value >= least;

/** The blinds make sense: whole chips, a big blind of at least one chip, a small blind up to it, an ante of none or more. */
function hasSensibleBlinds(level: PlayLevel): boolean {
  return isWhole(level.bigBlind, 1) && isWhole(level.smallBlind, 1) && level.smallBlind <= level.bigBlind && isWhole(level.ante, 0);
}

/** Two breaks one after the other. */
function hasBreaksTogether(stages: readonly Stage[]): boolean {
  return stages.some((stage, index) => stage.kind === 'break' && stages[index + 1]?.kind === 'break');
}

/**
 * What is wrong with a blind structure, or null when the clock can run it: at least one stage and at
 * most sixty, a level first, never two breaks together, each stage one to 120 whole minutes, and
 * sensible blinds. The database's private.blind_levels_problem says the same.
 */
export function structureProblem(stages: readonly Stage[]): StructureProblem | null {
  if (stages.length === 0) return 'empty';
  if (stages.length > MOST_STAGES) return 'too_long';
  if (stages[0]?.kind === 'break') return 'break_first';
  if (hasBreaksTogether(stages)) return 'breaks_together';
  if (stages.some((stage) => !isWhole(stage.minutes, 1) || stage.minutes > MOST_MINUTES)) return 'minutes';
  if (stages.some((stage) => stage.kind === 'level' && !hasSensibleBlinds(stage))) return 'blinds';
  return null;
}

/** The structure's length in minutes, breaks included. */
export function structureMinutes(stages: readonly Stage[]): number {
  return stages.reduce((total, stage) => total + stage.minutes, 0);
}

/** How many levels of play the structure has, breaks aside. */
export function levelCount(stages: readonly Stage[]): number {
  return stages.filter((stage) => stage.kind === 'level').length;
}
