/**
 * Stage 3 checks on what a rule claims: hands it never looks at, branches on
 * coordinates it never samples, pots it never names.
 */
import { STREETS, situationStreets, type OntologyPayload, type Principle, type Situation } from '../ontology/types.ts';
import { CODES, type Finding } from './report.ts';

/** The four coordinates that say something about the hero's cards. */
const HAND_SLOTS = ['hand_class_any', 'draw_class_any', 'draw_class_exclude', 'relative_strength_any'] as const;

const readsHand = (situation: Situation): boolean =>
    HAND_SLOTS.some((slot) => (situation[slot] ?? []).length > 0);

/** Whether a situation can be on any street after preflop. */
const reachesPostflop = (situation: Situation): boolean =>
    (situationStreets(situation) ?? STREETS).some((street) => street !== 'preflop');

/**
 * A postflop rule that answers every hand without ever stating one.
 *
 * Silence and a written-out list are two different acts, and only one of them
 * is a claim. A rule that names all thirteen hand classes and says `check` is
 * its source asserting the answer does not depend on your cards. A rule that
 * names none of them gets the same reach by accident: every hand class on every
 * board it matches, answered by a single default. A reader who flopped a set
 * could be told to raise for reasons that only make sense as a bluff, and there
 * was no way to tell that verdict from one the engine had actually considered.
 *
 * So: state the classes, or narrow. An ERROR rather than a warning because,
 * unlike `pot_type`, there is no reading under which "I did not look at the
 * hand" is the intended scope of a postflop rule — the widest honest claim is
 * still writing the list out.
 *
 * Branches count: a rule whose situation is silent but whose branches read the
 * hand does look at it, and is answering different hands differently, which is
 * the thing this check exists to require.
 */
export function unexaminedHand(payload: OntologyPayload): Finding[] {
    return payload.principles.flatMap((principle, index): Finding[] => {
        if (principle.drillable === false) return [];
        const rule = principle.override_rule ?? principle.rule;
        if (rule.kind !== 'predicate' || !reachesPostflop(rule.situation)) return [];
        if (readsHand(rule.situation) || rule.branches.some((branch) => readsHand(branch.when))) return [];
        return [{
            stage: 3,
            severity: 'error',
            code: CODES.HAND_NEVER_EXAMINED,
            path: `/principles/${index}/rule/situation/hand_class_any`,
            objectId: principle.id,
            message: 'This rule answers every hand without ever stating one: no hand class, no draw class, '
                + 'no relative strength, and no branch that reads them — so a set and seven-high get the same '
                + 'verdict and the same reason. Name the hands the passage is about, or write every class out '
                + 'if it really does mean all of them.',
        }];
    });
}

/**
 * Slots the generator leaves UNSET unless the rule's own situation claims them.
 *
 * Most coordinates are sampled whether or not a rule names them — an omitted
 * `pot_type` still gets one, because every spot is some kind of pot. These two
 * are different: an opponent's bet has a size only once somebody says there is
 * a bet to size, and an opponent has a TYPE only once the source names the
 * types it is talking about. So the generator leaves them undefined, and the
 * matcher reads undefined as "does not match a constraint".
 */
export const SLOTS_UNSET_UNLESS_CLAIMED = ['villain_raise_size', 'villain_types'] as const;

/** Every branch and exception condition of a predicate principle, with its path. */
function conditionsOf(principle: Principle, index: number): { when: Situation; path: string }[] {
    const rule = principle.override_rule ?? principle.rule;
    if (rule.kind !== 'predicate') return [];
    const base = principle.override_rule === undefined ? 'rule' : 'override_rule';
    return [
        ...rule.branches.map((branch, position) => ({
            when: branch.when,
            path: `/principles/${index}/${base}/branches/${position}/when`,
        })),
        ...(principle.exceptions ?? []).map((exception, position) => ({
            when: exception.when,
            path: `/principles/${index}/exceptions/${position}/when`,
        })),
    ];
}

/** The unset-unless-claimed slots one condition reads and its rule's situation never claims. */
function unclaimedReads(principle: Principle, when: Situation, path: string): Finding[] {
    const situation = (principle.override_rule ?? principle.rule).situation;
    return SLOTS_UNSET_UNLESS_CLAIMED.flatMap((slot): Finding[] => {
        const wanted: readonly string[] = when[slot] ?? [];
        const claimed: readonly string[] = situation[slot] ?? [];
        if (wanted.length === 0 || claimed.length > 0) return [];
        return [{
            stage: 3,
            severity: 'error',
            code: CODES.BRANCH_READS_UNCLAIMED_SLOT,
            path: `${path}/${slot}`,
            objectId: principle.id,
            message: `This condition needs a ${slot}, but the rule's own situation never claims one — `
                + 'so the generator leaves it unset and this branch can never fire on a spot a reader '
                + `is dealt. Add ${slot} to the rule's situation with the values the passage is about.`,
            witness: wanted.join(', '),
        }];
    });
}

/**
 * A branch that keys on a coordinate its own rule never claims.
 *
 * The branch fires happily on the author's worked example — a quiz hand states
 * whatever the source states — and can NEVER fire on a generated spot, because
 * the generator leaves the coordinate unset and the matcher refuses it. So the
 * rule quietly abstains on everything that branch was written for: measured on
 * a real encoding, one rule declined 93% of its spots this way and the reader
 * never once met the case the branch existed for.
 *
 * An ERROR, not a warning: it is dead code with a live-looking test, which is
 * the worst kind. The fix is one line — name the values in the situation, which
 * is what the rule was claiming all along.
 */
export function branchesOnUnclaimedSlots(payload: OntologyPayload): Finding[] {
    return payload.principles.flatMap((principle, index) => {
        if (principle.drillable === false) return [];
        return conditionsOf(principle, index).flatMap(({ when, path }) => unclaimedReads(principle, when, path));
    });
}

/**
 * A postflop rule that never says what kind of pot it is about.
 *
 * An omitted slot claims every value, and for `pot_type` that is a bigger
 * claim than it looks: it says the passage holds in a four-bet pot as much as a
 * limped one. In one real encoding eleven rules omitted it, and each dealt a
 * quarter of its spots as four-bet pots its source never discussed after the
 * flop. A WARNING: a source may genuinely state a rule for any pot, and the
 * generator now weights the kinds it deals; but an author should say so on
 * purpose.
 */
export function unstatedPotType(payload: OntologyPayload): Finding[] {
    return payload.principles.flatMap((principle, index): Finding[] => {
        if (principle.drillable === false) return [];
        const rule = principle.override_rule ?? principle.rule;
        if (!reachesPostflop(rule.situation) || (rule.situation.pot_type ?? []).length > 0) return [];
        return [{
            stage: 3,
            severity: 'warning',
            code: CODES.POT_TYPE_UNSTATED,
            path: `/principles/${index}/rule/situation/pot_type`,
            objectId: principle.id,
            message: 'No pot_type: this rule claims limped, single-raised, three-bet and four-bet pots alike. '
                + 'Name the kinds the passage is about, or leave it out on purpose.',
        }];
    });
}
