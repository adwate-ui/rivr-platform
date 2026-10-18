/**
 * Stage 5 findings: branches that overlap, repeat the default, or can never fire.
 * The geometry lives in `determinacy.ts`; this decides what each shape means
 * to the author.
 */
import type { OntologyPayload, PredicateRule } from '../ontology/types.ts';
import { CODES, type Finding } from './report.ts';
import { findOverlaps, isShadowed, outcomeKey } from './determinacy.ts';

interface RuleAt {
    readonly rule: PredicateRule;
    readonly index: number;
    readonly objectId: string;
}

/** Overlapping branches: information when they agree, an error when they do not. */
function overlapFindings({ rule, index, objectId }: RuleAt): Finding[] {
    return findOverlaps(rule).map((overlap): Finding => (overlap.sameOutcome
        ? {
            stage: 5,
            severity: 'info',
            code: CODES.DET_BRANCH_CONFLICT,
            path: `/principles/${index}/rule/branches/${overlap.second}`,
            objectId,
            message: `Branches ${overlap.first} and ${overlap.second} overlap but agree, so nothing is ambiguous. They could be merged.`,
            witness: overlap.witness,
        }
        : {
            stage: 5,
            // An error: the flop is enumerated exhaustively, so an overlap that
            // survives `findOverlaps` is proven reachable.
            severity: 'error',
            code: CODES.DET_BRANCH_CONFLICT,
            path: `/principles/${index}/rule/branches/${overlap.second}/when`,
            objectId,
            message: `Branches ${overlap.first} and ${overlap.second} can both match the same spot and give different answers. Whichever is written first silently wins.`,
            witness: overlap.witness,
        }));
}

const constrainsNothing = (when: PredicateRule['branches'][number]['when']): boolean =>
    Object.values(when).every((value) => value === undefined || (Array.isArray(value) && value.length === 0));

/**
 * Two shapes of dead branch a real encoding turned out to contain and no gate
 * noticed. A branch whose outcome is byte-for-byte the default can never change
 * an answer — it is scope written where scope does not narrow. And a branch
 * whose `when` constrains nothing matches every spot the rule admits, so every
 * later branch and the default are unreachable: the rule says "bet medium,
 * always" while looking like a decision.
 */
function deadBranchFindings({ rule, index, objectId }: RuleAt): Finding[] {
    const findings: Finding[] = [];
    rule.branches.forEach((branch, position) => {
        if (rule.default !== undefined && outcomeKey(branch.then) === outcomeKey(rule.default)) {
            findings.push({
                stage: 5,
                severity: 'warning',
                code: CODES.DET_BRANCH_SAME_AS_DEFAULT,
                path: `/principles/${index}/rule/branches/${position}/then`,
                objectId,
                message: `Branch ${position} answers exactly what the default answers, so it never changes anything. Either the branch is scope that belongs in the situation, or the default is wrong.`,
            });
        }
        const buriesLater = position < rule.branches.length - 1 || rule.default !== undefined;
        if (constrainsNothing(branch.when) && buriesLater) {
            findings.push({
                stage: 5,
                severity: 'warning',
                code: CODES.DET_BRANCH_ALWAYS_MATCHES,
                path: `/principles/${index}/rule/branches/${position}/when`,
                objectId,
                message: `Branch ${position} constrains nothing, so it matches every spot the rule admits and nothing after it can ever fire.`,
            });
        }
    });
    return findings;
}

/** The first earlier branch that covers the one at `position`, if any. */
function shadowingBranch(rule: PredicateRule, position: number): number | undefined {
    const later = rule.branches[position];
    if (later === undefined) return undefined;
    const covering = rule.branches.slice(0, position).findIndex((earlier) => isShadowed(
        { ...rule.situation, ...earlier.when },
        { ...rule.situation, ...later.when },
    ));
    return covering === -1 ? undefined : covering;
}

/** Branches an earlier branch always wins first. */
function unreachableFindings({ rule, index, objectId }: RuleAt): Finding[] {
    return rule.branches.flatMap((_branch, position): Finding[] => {
        const earlier = shadowingBranch(rule, position);
        if (earlier === undefined) return [];
        return [{
            stage: 5,
            severity: 'warning',
            code: CODES.DET_BRANCH_UNREACHABLE,
            path: `/principles/${index}/rule/branches/${position}/when`,
            objectId,
            message: `Branch ${position} is entirely covered by branch ${earlier}, so it can never fire.`,
        }];
    });
}

/** Stage 5: is every predicate rule's answer decided by its conditions rather than its order? */
export function stage5Determinacy(payload: OntologyPayload): Finding[] {
    return payload.principles.flatMap((principle, index) => {
        const rule = principle.override_rule ?? principle.rule;
        if (rule.kind !== 'predicate') return [];
        const at: RuleAt = { rule, index, objectId: principle.id };
        return [...overlapFindings(at), ...deadBranchFindings(at), ...unreachableFindings(at)];
    });
}
