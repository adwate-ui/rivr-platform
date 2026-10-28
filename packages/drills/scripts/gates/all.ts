/**
 * The eight drill gates by name: the command line runs them over files, the console over an upload (#131).
 */
import type { Gate } from './gate.ts';
import { sourcesGate } from './sourcesGate.ts';
import { generatorGate } from './generatorGate.ts';
import { winnableGate } from './winnableGate.ts';
import { overclaimGate } from './overclaimGate.ts';
import { feedbackGate } from './feedbackGate.ts';
import { varietyGate } from './varietyGate.ts';
import { linesGate } from './linesGate.ts';
import { meceGate } from './meceGate.ts';

export const GATE_NAMES = ['sources', 'generator', 'winnable', 'overclaim', 'feedback', 'variety', 'lines', 'mece'] as const;
export type GateName = typeof GATE_NAMES[number];

export const GATES: Readonly<Record<GateName, Gate>> = {
    sources: sourcesGate, generator: generatorGate, winnable: winnableGate, overclaim: overclaimGate,
    feedback: feedbackGate, variety: varietyGate, lines: linesGate, mece: meceGate,
};
