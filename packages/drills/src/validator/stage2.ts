/**
 * Stage 2: does every id resolve?
 *
 * Short-circuits the pipeline: nothing downstream can reason about a payload
 * whose ids point at nothing.
 */
import type { OntologyPayload, Principle, Situation } from '../ontology/types.ts';
import { CODES, type Finding } from './report.ts';

/** One error finding, appended. Every stage-2 finding is an error. */
type Report = (code: Finding['code'], path: string, message: string, objectId?: string) => void;

interface Ids {
    readonly ranges: ReadonlySet<string>;
    readonly opponents: ReadonlySet<string>;
    readonly principles: ReadonlySet<string>;
}

/** Ids reachable from a node, following `edges`, reporting the first cycle found. */
function findCycle(ids: readonly string[], edges: (id: string) => readonly string[]): string[] | null {
    const state = new Map<string, 'open' | 'done'>();
    const stack: string[] = [];

    const walk = (id: string): string[] | null => {
        const seen = state.get(id);
        if (seen === 'done') return null;
        if (seen === 'open') return [...stack.slice(stack.indexOf(id)), id];

        state.set(id, 'open');
        stack.push(id);
        for (const next of edges(id)) {
            const cycle = walk(next);
            if (cycle !== null) return cycle;
        }
        stack.pop();
        state.set(id, 'done');
        return null;
    };

    for (const id of ids) {
        const cycle = walk(id);
        if (cycle !== null) return cycle;
    }
    return null;
}

function duplicates(ids: readonly string[]): string[] {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    ids.forEach((id) => (seen.has(id) ? repeated.add(id) : seen.add(id)));
    return [...repeated];
}

function checkDuplicates(payload: OntologyPayload, report: Report): void {
    duplicates(payload.principles.map((p) => p.id))
        .forEach((id) => report(CODES.DUPLICATE_ID, '/principles', `Two principles share the id "${id}"`, id));
    duplicates(payload.range_sets.map((s) => s.id))
        .forEach((id) => report(CODES.DUPLICATE_ID, '/range_sets', `Two range sets share the id "${id}"`, id));
    duplicates(payload.opponent_types.map((t) => t.id))
        .forEach((id) => report(CODES.DUPLICATE_ID, '/opponent_types', `Two opponent types share the id "${id}"`, id));
}

function checkRangeParents(payload: OntologyPayload, ids: Ids, report: Report): void {
    payload.range_sets.forEach((set, index) => {
        if (set.derived_from === undefined || ids.ranges.has(set.derived_from)) return;
        report(
            CODES.UNKNOWN_PARENT_RANGE,
            `/range_sets/${index}/derived_from`,
            `Derives from "${set.derived_from}", which is not a range set in this payload`,
            set.id,
        );
    });

    const rangeCycle = findCycle(
        payload.range_sets.map((set) => set.id),
        (id) => {
            const parent = payload.range_sets.find((set) => set.id === id)?.derived_from;
            return parent !== undefined && ids.ranges.has(parent) ? [parent] : [];
        },
    );
    if (rangeCycle !== null) {
        report(CODES.RANGE_CYCLE, '/range_sets', `Range sets derive from each other in a loop: ${rangeCycle.join(' -> ')}`);
    }
}

/** Every situation a principle carries, with its path under the principle. */
function eachSituation(principle: Principle, visit: (situation: Situation, path: string) => void): void {
    const rule = principle.override_rule ?? principle.rule;
    const base = principle.override_rule === undefined ? 'rule' : 'override_rule';
    visit(rule.situation, `${base}/situation`);
    if (rule.kind === 'predicate') {
        rule.branches.forEach((branch, index) => visit(branch.when, `${base}/branches/${index}/when`));
    }
    (principle.exceptions ?? []).forEach((exception, index) => visit(exception.when, `exceptions/${index}/when`));
}

/** A principle, where it sits, and the ids it may reference. */
interface PrincipleAt {
    readonly principle: Principle;
    readonly at: string;
    readonly ids: Ids;
}

function checkOwnReferences({ principle, at, ids }: PrincipleAt, sourceId: string, report: Report): void {
    if (principle.source_id !== sourceId) {
        report(CODES.SOURCE_ID_MISMATCH, `${at}/source_id`,
            `Claims source "${principle.source_id}" but this payload is source "${sourceId}"`, principle.id);
    }
    const rule = principle.override_rule ?? principle.rule;
    if (rule.kind === 'range_lookup' && !ids.ranges.has(rule.range_set_id)) {
        report(CODES.UNKNOWN_RANGE_SET, `${at}/rule/range_set_id`,
            `References range set "${rule.range_set_id}", which does not exist`, principle.id);
    }
    (principle.prerequisites ?? []).forEach((prerequisite, position) => {
        if (ids.principles.has(prerequisite)) return;
        report(CODES.UNKNOWN_PREREQUISITE, `${at}/prerequisites/${position}`,
            `Requires "${prerequisite}", which is not a principle in this payload`, principle.id);
    });
}

function checkNestedReferences({ principle, at, ids }: PrincipleAt, report: Report): void {
    (principle.modifiers ?? []).forEach((modifier, position) => {
        const substitute = modifier.effect.substitute_range_set_id;
        if (substitute === undefined || ids.ranges.has(substitute)) return;
        report(CODES.UNKNOWN_RANGE_SET, `${at}/modifiers/${position}/effect/substitute_range_set_id`,
            `Substitutes range set "${substitute}", which does not exist`, principle.id);
    });
    eachSituation(principle, (situation, path) => {
        (situation.villain_types ?? []).forEach((type, position) => {
            if (ids.opponents.has(type)) return;
            report(CODES.UNKNOWN_OPPONENT_TYPE, `${at}/${path}/villain_types/${position}`,
                `References opponent type "${type}", which this source does not define`, principle.id);
        });
    });
}

function checkPrincipleReferences(payload: OntologyPayload, ids: Ids, report: Report): void {
    payload.principles.forEach((principle, index) => {
        const where: PrincipleAt = { principle, at: `/principles/${index}`, ids };
        checkOwnReferences(where, payload.source.id, report);
        checkNestedReferences(where, report);
    });
}

/**
 * Ontology 1.2 types `villain_type_id` as a plain string, so the schema cannot
 * tell a real opponent id from a typo. Without this the value has merely MOVED
 * from free prose into a field that looks checked — which is worse, because it
 * now reads as validated. A mis-referenced type was found this way during a
 * harness run, on 11 hands, and every one of them silently failed to match the
 * principles keyed on that opponent.
 */
function checkQuizOpponents(payload: OntologyPayload, ids: Ids, report: Report): void {
    (payload.quiz_hands ?? []).forEach((quiz, index) => {
        const typeId = quiz.situation_instance.villain_type_id;
        if (typeId === undefined || ids.opponents.has(typeId)) return;
        report(CODES.UNKNOWN_OPPONENT_TYPE, `/quiz_hands/${index}/situation_instance/villain_type_id`,
            `References opponent type "${typeId}", which this source does not define`, quiz.id);
    });
}

function checkPrerequisiteCycle(payload: OntologyPayload, ids: Ids, report: Report): void {
    const prerequisiteCycle = findCycle(
        payload.principles.map((principle) => principle.id),
        (id) => (payload.principles.find((principle) => principle.id === id)?.prerequisites ?? [])
            .filter((prerequisite) => ids.principles.has(prerequisite)),
    );
    if (prerequisiteCycle === null) return;
    report(CODES.PREREQUISITE_CYCLE, '/principles',
        `Prerequisites form a loop, so none of these could ever unlock: ${prerequisiteCycle.join(' -> ')}`);
}

/** Stage 2: every id the payload references exists, once, and no reference loops. */
export function stage2Referential(payload: OntologyPayload): Finding[] {
    const findings: Finding[] = [];
    const report: Report = (code, path, message, objectId) => {
        findings.push({ stage: 2, severity: 'error', code, path, message, objectId });
    };
    const ids: Ids = {
        ranges: new Set(payload.range_sets.map((set) => set.id)),
        opponents: new Set(payload.opponent_types.map((type) => type.id)),
        principles: new Set(payload.principles.map((principle) => principle.id)),
    };

    checkDuplicates(payload, report);
    checkRangeParents(payload, ids, report);
    checkPrincipleReferences(payload, ids, report);
    checkQuizOpponents(payload, ids, report);
    checkPrerequisiteCycle(payload, ids, report);
    return findings;
}
