/**
 * Stage 6: feedback coverage, and the thing that actually kills this product:
 * thinness.
 *
 * A principle with `feedback.correct` and no error key can tell the user they
 * were right and nothing else, which is half a drill. A principle whose
 * situation collapses to three scenarios is worse — it passes every other
 * stage, generates forever, and is recognisable by its third repetition. That
 * one is reported as a warning rather than an error because the fix is
 * editorial, not mechanical.
 */
import type { OntologyPayload, Outcome, Principle } from '../ontology/types.ts';
import { CODES, type Finding } from './report.ts';
import { isConstantRule } from './constantRule.ts';
import { reachableErrors } from './reachableErrors.ts';

/** Error keys that count as "the author said something about getting it wrong". */
export const ERROR_FEEDBACK_KEYS = [
    'too_loose', 'too_tight', 'too_passive', 'too_aggressive',
    'wrong_sizing', 'right_idea_wrong_spot',
    // 1.9: the only wrong answer a classify rule has. Without it here, a rule
    // that authors `wrong_label` and nothing else reads as having no feedback
    // for any mistake at all.
    'wrong_label',
    // 2.0: a count is out in one of two directions.
    'too_few', 'too_many',
] as const;

/** Below this many distinct scenarios, a principle will feel repetitive within a week. */
export const THIN_SCENARIO_THRESHOLD = 8;

export interface CoverageInput {
    readonly payload: OntologyPayload;
    /** Distinct scenarios each principle can produce, keyed by principle id. */
    readonly scenarioCounts: ReadonlyMap<string, number>;
}

/** A principle and where it sits, for building its findings. */
interface PrincipleAt {
    readonly principle: Principle;
    readonly at: string;
}

const isDrilled = (principle: Principle): boolean => principle.drillable !== false;

const finding = (
    { principle, at }: PrincipleAt,
    fields: Pick<Finding, 'severity' | 'code' | 'message'> & { path?: string; witness?: unknown },
): Finding => ({ stage: 6, path: at, objectId: principle.id, ...fields });

function emptyCorrect(where: PrincipleAt): Finding[] {
    if (where.principle.feedback.correct.trim() !== '') return [];
    return [finding(where, {
        severity: 'error', code: CODES.FEEDBACK_EMPTY, path: `${where.at}/feedback/correct`,
        message: 'feedback.correct is empty, so a right answer gets no response',
    })];
}

/** Every action outcome of a rule, with its path. Labels and counts have none. */
function actionOutcomes({ principle, at }: PrincipleAt): { path: string; outcome: Outcome }[] {
    const rule = principle.override_rule ?? principle.rule;
    const own = rule.kind === 'range_lookup'
        ? [
            ...(rule.in_range === undefined ? [] : [{ path: `${at}/rule/in_range`, outcome: rule.in_range }]),
            ...(rule.out_of_range === undefined ? [] : [{ path: `${at}/rule/out_of_range`, outcome: rule.out_of_range }]),
        ]
        : rule.kind === 'predicate'
            ? [
                ...rule.branches.map((branch, b) => ({ path: `${at}/rule/branches/${b}/then`, outcome: branch.then })),
                ...(rule.default === undefined ? [] : [{ path: `${at}/rule/default`, outcome: rule.default }]),
            ]
            : [];
    const exceptions = (principle.exceptions ?? [])
        .map((exception, e) => ({ path: `${at}/exceptions/${e}/then`, outcome: exception.then }));
    return [...own, ...exceptions];
}

/**
 * A rule with more than one right ANSWER has more than one reason, and one
 * `correct` string cannot give both. A range rule that raises the list and
 * folds the rest once praised a reader who correctly folded for raising — so
 * every outcome of such a rule carries its own `feedback.correct`, and this is
 * where that is checked rather than hoped for.
 */
function ambiguousSides(where: PrincipleAt): Finding[] {
    if (!isDrilled(where.principle)) return [];
    const outcomes = actionOutcomes(where);
    const actions = new Set(outcomes.map(({ outcome }) => outcome.action));
    if (actions.size <= 1) return [];
    return outcomes
        .filter(({ outcome }) => (outcome.feedback?.correct ?? '').trim() === '')
        .map(({ path, outcome }) => finding(where, {
            severity: 'error', code: CODES.FEEDBACK_SIDE_AMBIGUOUS, path,
            message: `This rule answers ${[...actions].join(' or ')} depending on the spot, and this outcome (${outcome.action}) has no feedback.correct of its own — the principle's one sentence cannot be right for both.`,
        }));
}

/**
 * A principle the source marked `drillable: false` routes to concept recall
 * rather than a decision drill, so there is no wrong answer for it to have
 * feedback about. Demanding an error key from one is asking the author to
 * write a response to a question nobody is asked.
 */
function noErrorKey(where: PrincipleAt): Finding[] {
    const feedback = where.principle.feedback;
    const errorKeys = ERROR_FEEDBACK_KEYS.filter((key) => (feedback[key] ?? '').trim() !== '');
    if (!isDrilled(where.principle) || errorKeys.length > 0) return [];
    return [finding(where, {
        severity: 'error', code: CODES.FEEDBACK_NO_ERROR_KEY, path: `${where.at}/feedback`,
        message: 'No feedback for any wrong answer; the drill could only ever say "correct"',
    })];
}

/**
 * ...and one key is not enough. A real encoding once shipped most of its
 * principles with a mistake the reader could make and no sentence to meet it,
 * so a wrong answer got the engine's own filler. Since the reachable set is
 * derived rather than assumed, this asks for one or two sentences per
 * principle, not all six.
 */
function unreachedErrors(where: PrincipleAt): Finding[] {
    if (!isDrilled(where.principle)) return [];
    const feedback = where.principle.feedback;
    return [...reachableErrors(where.principle)]
        .filter((klass) => (feedback[klass] ?? '').trim() === '')
        .map((klass) => finding(where, {
            severity: 'error', code: CODES.FEEDBACK_UNREACHED_ERROR, path: `${where.at}/feedback/${klass}`,
            message: `A reader can answer this in a way graded "${klass}" and there is `
                + 'nothing authored to tell them why. Write the source\'s own sentence '
                + 'for it, or narrow the rule so the mistake cannot arise.',
        }));
}

/**
 * Abstention arrived with 1.3 (predicates) and 1.5 (range lookups), and brought
 * one way to write a rule that can never do anything: no side that could ever
 * answer. It matches spots and declines every one. A count rule always answers:
 * a range against a board has a number.
 */
function neverAnswers(where: PrincipleAt): Finding[] {
    const rule = where.principle.override_rule ?? where.principle.rule;
    const silent = rule.kind === 'count' ? false
        : rule.kind === 'range_lookup'
            ? rule.in_range === undefined && rule.out_of_range === undefined
            : rule.default === undefined && rule.branches.length === 0;
    if (!silent) return [];
    return [finding(where, {
        severity: 'error', code: CODES.RULE_NEVER_ANSWERS, path: `${where.at}/rule`,
        message: 'Every side of this rule is omitted, so it abstains on every spot '
            + 'it matches and can never answer anything. Give it something to say, '
            + 'or delete it.',
    })];
}

function constantRule(where: PrincipleAt): Finding[] {
    if (!isDrilled(where.principle) || !isConstantRule(where.principle)) return [];
    return [finding(where, {
        severity: 'warning', code: CODES.CONSTANT_RULE, path: `${where.at}/rule`,
        message: 'This rule returns the same answer for every spot it claims, and its situation '
            + 'names nothing that would narrow which spots those are. Drilling it teaches one '
            + 'word. Either give it a coordinate that distinguishes the spots it applies to, or '
            + 'mark it drillable: false and let it be concept recall.',
    })];
}

function thinEncoding(where: PrincipleAt, count: number | undefined): Finding[] {
    if (count === undefined || count >= THIN_SCENARIO_THRESHOLD) return [];
    return [finding(where, {
        severity: 'warning', code: CODES.THIN_ENCODING, path: `${where.at}/rule/situation`,
        message: `Only ${count} distinct scenarios can be generated here, so this will start repeating almost immediately. Widen the situation or merge it with a neighbour.`,
        witness: count,
    })];
}

/** Stage 6: every principle can respond to every answer, and has room to vary. */
export function stage6Coverage({ payload, scenarioCounts }: CoverageInput): Finding[] {
    const findings = payload.principles.flatMap((principle, index) => {
        const where: PrincipleAt = { principle, at: `/principles/${index}` };
        return [
            ...emptyCorrect(where),
            ...ambiguousSides(where),
            ...noErrorKey(where),
            ...unreachedErrors(where),
            ...neverAnswers(where),
            ...constantRule(where),
            ...thinEncoding(where, scenarioCounts.get(principle.id)),
        ];
    });
    if ((payload.quiz_hands ?? []).length > 0) return findings;
    return [...findings, {
        stage: 6,
        severity: 'info',
        code: CODES.NO_QUIZ_HANDS,
        path: '/quiz_hands',
        message: 'No quiz hands, so there is nothing to check the encoding against the author\'s own worked examples.',
    }];
}
