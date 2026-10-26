/**
 * The tournament golden files' way of writing a blind structure, so a non-engineer can read it:
 * `100/200 ante 200 for 20; break 10; 150/300 for 20`. Levels and breaks in minutes, chips as numbers.
 */

/** A stage as the domain's tournament module takes it. */
export type NotedStage =
  | { readonly kind: 'level'; readonly smallBlind: number; readonly bigBlind: number; readonly ante: number; readonly minutes: number }
  | { readonly kind: 'break'; readonly minutes: number };

const LEVEL = /^(\d+)\/(\d+)(?: ante (\d+))? for (\d+)$/;
const BREAK = /^break (\d+)$/;

function parseStage(text: string): NotedStage {
  const asBreak = BREAK.exec(text);
  if (asBreak) return { kind: 'break', minutes: Number(asBreak[1]) };
  const asLevel = LEVEL.exec(text);
  if (!asLevel) throw new Error(`"${text}" is not a level or a break`);
  return { kind: 'level', smallBlind: Number(asLevel[1]), bigBlind: Number(asLevel[2]), ante: Number(asLevel[3] ?? 0), minutes: Number(asLevel[4]) };
}

/** A structure from its notation; throws on anything else, because a broken fixture is a bug. */
export function parseStages(notation: string): NotedStage[] {
  return notation.split(';').map((part) => parseStage(part.trim()));
}

/** A structure in the notation, ante left out when there is none. */
export function formatStages(stages: readonly NotedStage[]): string {
  return stages.map((stage) => {
    if (stage.kind === 'break') return `break ${String(stage.minutes)}`;
    const ante = stage.ante > 0 ? ` ante ${String(stage.ante)}` : '';
    return `${String(stage.smallBlind)}/${String(stage.bigBlind)}${ante} for ${String(stage.minutes)}`;
  }).join('; ');
}

/** `138:20` as seconds. */
export function parseMinutesSeconds(text: string): number {
  const [minutes, seconds] = text.split(':').map(Number);
  if (minutes === undefined || seconds === undefined || Number.isNaN(minutes) || Number.isNaN(seconds)) throw new Error(`"${text}" is not minutes:seconds`);
  return minutes * 60 + seconds;
}

/** Seconds as `11:40`. */
export function formatMinutesSeconds(total: number): string {
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, '0')}`;
}
