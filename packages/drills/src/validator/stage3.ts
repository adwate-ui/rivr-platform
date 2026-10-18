/**
 * Stage 3: does every value mean something?
 *
 * The schema checks shapes; this checks what a shape cannot say. A range
 * notation the schema's pattern lets through but no parser accepts, a card that
 * is not a card, a label nobody offers, a line that contradicts its own facing
 * state. Runs to completion even after an error, so the author sees every
 * problem in one pass.
 */
import { parseCard } from '../cards/cards.ts';
import type { OntologyPayload, QuizHand } from '../ontology/types.ts';
import { parseRangeToken } from '../range/parse.ts';
import { CODES, type Finding } from './report.ts';
import { contradictoryLines, unknownPathSteps } from './stage3Lines.ts';
import { branchesOnUnclaimedSlots, unexaminedHand, unstatedPotType } from './stage3Scope.ts';
import { answerability, classifyVocabulary, countVocabulary } from './stage3Answers.ts';

/** Why a token failed to parse. `parseRangeToken` throws `RangeParseError` and nothing else. */
function parseFailure(token: string): string | undefined {
    try {
        parseRangeToken(token);
        return undefined;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

function rangeNotation(payload: OntologyPayload): Finding[] {
    return payload.range_sets.flatMap((set, index) => {
        const check = (hands: readonly string[], field: string): Finding[] => hands.flatMap((hand, position) => {
            const message = parseFailure(hand);
            if (message === undefined) return [];
            return [{
                stage: 3,
                severity: 'error',
                code: CODES.BAD_RANGE_NOTATION,
                path: `/range_sets/${index}/${field}/${position}`,
                objectId: set.id,
                message,
            }];
        });
        return [...check(set.hands, 'hands'), ...check(set.excludes ?? [], 'excludes')];
    });
}

/** Cards that are not cards, then cards dealt twice, for one quiz hand. */
function quizCards(quiz: QuizHand, index: number): Finding[] {
    const instance = quiz.situation_instance;
    const all = [...(instance.hero_cards ?? []), ...(instance.board ?? [])];
    const path = `/quiz_hands/${index}/situation_instance`;

    const unreadable: Finding[] = all.flatMap((text, position): Finding[] => (parseCard(text) !== null ? [] : [{
        stage: 3, severity: 'error', code: CODES.BAD_CARD, path, objectId: quiz.id,
        message: `"${text}" is not a card`, witness: position,
    }]));

    const seen = new Set<string>();
    const repeated: Finding[] = all.flatMap((text): Finding[] => {
        const card = parseCard(text);
        if (card === null) return [];
        const key = `${card.rank}${card.suit}`;
        const twice = seen.has(key);
        seen.add(key);
        return twice ? [{
            stage: 3, severity: 'error', code: CODES.DUPLICATE_CARD, path, objectId: quiz.id,
            message: `${key} appears twice; one deck cannot deal the same card to two places`,
        }] : [];
    });
    return [...unreadable, ...repeated];
}

/** Stage 3: every notation parses, every card is a card, and every rule means what it says. */
export function stage3Vocabulary(payload: OntologyPayload): Finding[] {
    return [
        ...rangeNotation(payload),
        ...(payload.quiz_hands ?? []).flatMap(quizCards),
        ...unknownPathSteps(payload),
        ...contradictoryLines(payload),
        ...unstatedPotType(payload),
        ...unexaminedHand(payload),
        ...branchesOnUnclaimedSlots(payload),
        ...answerability(payload),
        ...classifyVocabulary(payload),
        ...countVocabulary(payload),
    ];
}
