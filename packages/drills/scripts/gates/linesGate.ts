/**
 * Does the rule pin the line its own worked example records?
 *
 * The quiz harness compares the ANSWER on the source's hands, but an empty
 * `node_path` matches every hand vacuously: a turn rule written for "you bet
 * the flop and were called" passes with no path at all, and the generator,
 * which replays only the path, then deals it after a flop that was checked
 * through. The explanation then talks about a flop call that is not in the story.
 *
 * For every scored quiz hand and the rule that governs it:
 *
 *   1. Every chips-in step the hand's `action_log` records on a street BEFORE
 *      the decision street must be required by the rule's `node_path`.
 *   2. Where the log names the hero's preflop action, the action the generator
 *      would infer from the rule's path must agree: that is the inference the
 *      hole cards are dealt from.
 */
import { STREETS, type OntologyPayload, type Principle, type QuizHand } from '../../src/ontology/types.ts';
import { runHarness, scenarioFromQuizHand } from '../../src/harness/quizHarness.ts';
import { parseStep, stepsMatch } from '../../src/nodePath.ts';
import { heroPreflopAction } from '../../src/generator/preflopLine.ts';
import type { Scenario } from '../../src/generator/types.ts';
import { ruleOf } from './sampling.ts';
import { say } from './output.ts';
import { allowlistFor, LINES_ALLOWED } from './allowlists.ts';
import { verdictForFindings, type Gate } from './gate.ts';

const CHIPS_IN = /^(bet|raise|call|3bet|4bet|all_in|three_bet|four_bet)$/;
const PAST_TENSE: Readonly<Record<string, string>> = { raise: 'raised', call: 'called', limp: 'limped', '3bet': '3-bet' };

/** Chips-in steps on earlier streets that the rule's path does not require. */
function unpinnedSteps(log: readonly string[], path: readonly string[], scenario: Scenario): string[] {
    const decision = STREETS.indexOf(scenario.street);
    return log.filter((step) => {
        const parsed = parseStep(step);
        if (parsed.street === undefined || parsed.street === 'preflop') return false;
        if (STREETS.indexOf(parsed.street) >= decision || !CHIPS_IN.test(parsed.action)) return false;
        return !path.some((required) => stepsMatch(required, step));
    }).map((step) => `"${step}" is in the example's line and not in the rule's node_path`);
}

/** The hero's preflop action as the log records it, against what the rule's path implies. */
function preflopMismatch(log: readonly string[], path: readonly string[], scenario: Scenario): string[] {
    const recorded = log.map(parseStep).find((step) => step.street === 'preflop' && step.actor === 'hero');
    if (recorded === undefined || scenario.street === 'preflop') return [];
    // Inferred from the RULE's path, as the generator infers it.
    const inferred = heroPreflopAction({ ...scenario, nodePath: path });
    if (inferred === recorded.action) return [];
    const said = PAST_TENSE[recorded.action] ?? recorded.action;
    return [`the example says the hero ${said} preflop; the spot reads as "${inferred}", so the hole cards would come from the wrong range`];
}

function problemsFor(quiz: QuizHand, principle: Principle, payload: OntologyPayload): string[] {
    const scenario = scenarioFromQuizHand(quiz, payload);
    if (scenario === null) return [];
    const path = ruleOf(principle).situation.node_path ?? [];
    const log = quiz.situation_instance.action_log ?? [];
    return [...unpinnedSteps(log, path, scenario), ...preflopMismatch(log, path, scenario)];
}

interface Pairing {
    readonly quiz: QuizHand;
    readonly principle: Principle;
}

/** Every scored hand a rule claimed, with the rule. */
function governedHands(payload: OntologyPayload): Pairing[] {
    const byId = new Map(payload.principles.map((principle) => [principle.id, principle]));
    const quizById = new Map((payload.quiz_hands ?? []).map((quiz) => [quiz.id, quiz]));
    return runHarness(payload).results.flatMap((result): Pairing[] => {
        if (result.verdict !== 'pass' && result.verdict !== 'fail') return [];
        const quiz = quizById.get(result.quizId);
        const principle = result.principleId === undefined ? undefined : byId.get(result.principleId);
        return quiz === undefined || principle === undefined ? [] : [{ quiz, principle }];
    });
}

export const linesGate: Gate = {
    name: 'lines',
    run(run) {
        const payload = run.source.payload;
        const allowed = allowlistFor(LINES_ALLOWED, payload.source.id);
        const hands = governedHands(payload);
        let failures = 0;
        for (const { quiz, principle } of hands) {
            const problems = problemsFor(quiz, principle, payload);
            if (problems.length === 0) continue;
            const excuse = allowed.get(principle.id);
            if (excuse !== undefined) {
                say(`  allowed  ${principle.id.padEnd(38)} ${quiz.id}: ${excuse}`);
                continue;
            }
            failures += 1;
            say(`  UNPINNED ${principle.id.padEnd(38)} ${quiz.id}  path=${JSON.stringify(ruleOf(principle).situation.node_path ?? [])}`);
            problems.forEach((problem) => say(`           ${problem}`));
        }
        say(`line pinning — ${hands.length} scored hands checked, ${failures} unpinned`);
        if (failures === 0) return true;
        say('A rule whose example records a line it does not require is dealt that spot with an invented line.');
        return verdictForFindings(run, 'lines');
    },
};
