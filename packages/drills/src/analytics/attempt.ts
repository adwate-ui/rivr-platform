/**
 * What an attempt records.
 *
 * **An attempt row is self-describing.** It carries `sourceHash` AND the full
 * scenario attribute vector, rather than a seed to re-derive them from.
 *
 * That is the one persistence decision here that is expensive to get wrong.
 * Storing `seed + nodePath` and recomputing would be smaller, and it would
 * silently change the meaning of every historical attempt the day a classifier
 * bug is fixed — last month's "40% on monotone boards" would quietly become a
 * statement about a different set of boards. Denormalised, an analysis stays
 * true to what was actually on screen.
 *
 * It is also what makes cross-tabulation by attribute possible at all: the
 * generator varies coordinates no rule mentions, so the only record that a
 * spot was very deep is the one written down here.
 */

import type {
    BoardTag, DrawClass, HandClass, PlayerCount, PostflopFacingState, PotType, Position,
    PreflopFacingState, RelativeStrength, SizingBucket, SprBracket, StackBracket, Stakes,
    Street, Action, VillainRaiseSize, AnswerKind,
} from '../ontology/types.ts';
import type { ErrorClass } from '../grading/classifyError.ts';
import type { Scenario } from '../generator/types.ts';
import type { Grade } from '../scheduler/fsrs.ts';
import type { Provenance } from '../grading/resolve.ts';

export interface AttemptRow {
    readonly id: string;
    readonly sessionId: string;
    readonly sourceId: string;
    /** Which exact encoding this was graded against. */
    readonly sourceHash: string;
    readonly principleId: string;
    readonly seed: number;
    readonly nodePath: readonly string[];

    /* the scenario, denormalised so a cross-tab is a group-by */
    readonly street: Street;
    /**
     * The game. Sampled, spoken, shown on the felt and used to pick the
     * governing rule from the start — and for a long time the one coordinate
     * the row did not keep, so a reader could never ask "am I worse at 5-10?"
     * Optional because rows written before it existed lack it.
     */
    readonly stakes?: Stakes | undefined;
    readonly heroPosition: Position;
    /** Absent for an unopened preflop pot, which is not yet any kind of pot. */
    readonly potType?: PotType | undefined;
    readonly playerCount: PlayerCount;
    readonly stackBracket: StackBracket;
    readonly sprBracket?: SprBracket | undefined;
    readonly villainRaiseSize?: VillainRaiseSize | undefined;
    readonly villainArchetype?: string | undefined;
    readonly preflopFacingState?: PreflopFacingState | undefined;
    readonly postflopFacingState?: PostflopFacingState | undefined;
    readonly boardTags: readonly BoardTag[];
    readonly handClass?: HandClass | undefined;
    readonly drawClasses: readonly DrawClass[];
    readonly relativeStrength?: RelativeStrength | undefined;

    /* the answer */
    /**
     * Which kind of question this was (1.9). ABSENT on every row written before
     * answer kinds existed, and absent means `action` — the only kind there
     * was. Stored rows are never migrated: a row is a record of what happened,
     * and rewriting history to fit a later schema is how an analysis comes to
     * describe a session nobody had.
     */
    readonly answerKind?: AnswerKind | undefined;
    /** Both absent on a classify row, which has labels instead. */
    readonly submittedAction?: Action | undefined;
    readonly submittedSizing?: SizingBucket | undefined;
    readonly correctAction?: Action | undefined;
    readonly correctSizing?: SizingBucket | undefined;
    /** Both absent on an action row. The label ID, not the words shown. */
    readonly submittedLabel?: string | undefined;
    readonly correctLabel?: string | undefined;
    /** Both present only on a count row. */
    readonly submittedValue?: number | undefined;
    readonly correctValue?: number | undefined;
    readonly provenanceKind: Provenance['kind'];
    readonly errorClass: ErrorClass;
    readonly confusedWithSlot?: string | undefined;
    readonly grade: Grade;
    readonly latencyMs: number;
    readonly correct: boolean;
    readonly createdAt: number;
}

/**
 * A stable fingerprint of the encoding an attempt was graded against.
 *
 * Not cryptographic — it only has to change when the encoding changes, so that
 * an analysis can say "these attempts were graded against a different version
 * of the source" rather than silently mixing them.
 */
export function hashSource(payload: unknown): string {
    const text = JSON.stringify(payload);
    let h1 = 0x811c9dc5 >>> 0;
    let h2 = 0x01000193 >>> 0;
    for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
        h2 = Math.imul(h2 + code, 2246822519) >>> 0;
    }
    return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export interface RecordAttemptInput {
    readonly id: string;
    readonly sessionId: string;
    readonly sourceId: string;
    readonly sourceHash: string;
    readonly principleId: string;
    readonly scenario: Scenario;
    readonly answerKind?: AnswerKind | undefined;
    readonly submittedAction?: Action | undefined;
    readonly submittedSizing?: SizingBucket | undefined;
    readonly correctAction?: Action | undefined;
    readonly correctSizing?: SizingBucket | undefined;
    readonly submittedLabel?: string | undefined;
    readonly correctLabel?: string | undefined;
    /** Both present only on a count row. */
    readonly submittedValue?: number | undefined;
    readonly correctValue?: number | undefined;
    readonly provenanceKind: Provenance['kind'];
    readonly errorClass: ErrorClass;
    readonly confusedWithSlot?: string | undefined;
    readonly grade: Grade;
    readonly latencyMs: number;
    readonly correct: boolean;
    readonly now: number;
}

/** The scenario's coordinates, denormalised so a cross-tab is a group-by. */
function scenarioColumns(scenario: Scenario) {
    return {
        seed: scenario.seed,
        nodePath: scenario.nodePath,
        street: scenario.street,
        stakes: scenario.stakes,
        heroPosition: scenario.heroPosition,
        potType: scenario.potType,
        playerCount: scenario.playerCount,
        stackBracket: scenario.stackBracket,
        sprBracket: scenario.sprBracket,
        villainRaiseSize: scenario.villainRaiseSize,
        villainArchetype: scenario.villainType,
        preflopFacingState: scenario.preflopFacingState,
        postflopFacingState: scenario.postflopFacingState,
        boardTags: scenario.boardTags,
        handClass: scenario.handClass,
        drawClasses: scenario.draws ?? [],
        relativeStrength: scenario.relativeStrength,
    };
}

/** What was submitted and what was right, in the vocabulary of the question. */
function answerColumns(input: RecordAttemptInput) {
    return {
        answerKind: input.answerKind,
        submittedLabel: input.submittedLabel,
        correctLabel: input.correctLabel,
        submittedValue: input.submittedValue,
        correctValue: input.correctValue,
        submittedAction: input.submittedAction,
        submittedSizing: input.submittedSizing,
        correctAction: input.correctAction,
        correctSizing: input.correctSizing,
    };
}

/** Flattens a graded answer into the row that gets kept. */
export function toAttemptRow(input: RecordAttemptInput): AttemptRow {
    return {
        id: input.id,
        sessionId: input.sessionId,
        sourceId: input.sourceId,
        sourceHash: input.sourceHash,
        principleId: input.principleId,
        ...scenarioColumns(input.scenario),
        ...answerColumns(input),
        provenanceKind: input.provenanceKind,
        errorClass: input.errorClass,
        confusedWithSlot: input.confusedWithSlot,
        grade: input.grade,
        latencyMs: input.latencyMs,
        correct: input.correct,
        createdAt: input.now,
    };
}
