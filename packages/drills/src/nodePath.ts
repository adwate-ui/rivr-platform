/**
 * The vocabulary of `node_path` — the authored action sequence a rule is
 * scoped to, and the one thing about a spot the generator never invents.
 *
 * A step is `<street>_<action>` (`flop_bet`, `turn_call`), and since ontology
 * 1.7 may carry WHO acted: `hero_flop_bet`, `villain_flop_call`. The actor
 * matters more than it looks. "Flop: bet · Turn: bet · checked to you" cannot
 * tell a barrel from a call-down, and for several rules the whole teaching is
 * who did what: a river bet after the opponent checked the turn back reads
 * nothing like the same bet after the hero did. Without the actor a reader was
 * asked a question with half of it missing.
 *
 * Additive, so every earlier encoding stays valid: an unprefixed step matches
 * either actor, and a prefixed step matches an unprefixed record of the same
 * action. The vocabulary stays open (the validator spell-checks it against the
 * source's own quiz hands rather than closing it), so parsing is lenient and
 * never throws.
 */

import { STREETS, type Street } from './ontology/types.ts';
import { ENGLISH_WORDS, type DrillWords } from './words.ts';

export type Actor = 'hero' | 'villain';

export interface PathStep {
    readonly actor?: Actor | undefined;
    /** The street the step names, or undefined when the token is not `<street>_…`. */
    readonly street?: Street | undefined;
    readonly action: string;
    /** The step with any actor prefix removed — what two steps are compared on. */
    readonly bare: string;
}

/** A step split into actor, street and action. Lenient: an unknown token is all action. */
export function parseStep(step: string): PathStep {
    const actor: Actor | undefined = step.startsWith('hero_') ? 'hero'
        : step.startsWith('villain_') ? 'villain'
            : undefined;
    const bare = actor === undefined ? step : step.slice(actor.length + 1);
    const [first, ...rest] = bare.split('_');
    const street = STREETS.find((candidate) => candidate === first);
    const action = street === undefined ? bare : rest.join('_');
    return { actor, street, action, bare };
}

/** The step with any actor prefix removed. */
export const stripActor = (step: string): string => parseStep(step).bare;

/**
 * Does a required step match an actual one?
 *
 * Same action on the same street, and — only where BOTH name an actor — the
 * same actor. An unprefixed side is silent about who acted, and silence is
 * not a contradiction; it is the 1.6-and-earlier vocabulary, still valid.
 */
export function stepsMatch(required: string, actual: string): boolean {
    const want = parseStep(required);
    const have = parseStep(actual);
    if (want.bare !== have.bare) return false;
    return want.actor === undefined || have.actor === undefined || want.actor === have.actor;
}

/**
 * Does the line have a step by `actor` on a postflop street BEFORE `street`?
 *
 * The question "is there an earlier decision of the hero's own to check?" —
 * asked once per rule by the generator so that the rules with no earlier hero
 * action (most of them) pay nothing for `lineFits`. It lives here, with the
 * other readings of a path, so the generator and the check that follows it
 * cannot come to disagree about what "earlier" means.
 */
export function hasEarlierStep(
    nodePath: readonly string[],
    actor: Actor,
    street: Street,
): boolean {
    const decision = STREETS.indexOf(street);
    return nodePath.map(parseStep).some((step) =>
        step.actor === actor && step.street !== undefined && step.street !== 'preflop'
        && STREETS.indexOf(step.street) < decision);
}

/**
 * A step in plain words, for the spoken description and the action line.
 *
 * Past tense, because it has already happened: "you bet", "they called". An
 * unprefixed step has no subject and is left as the bare verb, which is what
 * it said before the actor existed.
 *
 * The de-underscore below IS a fallback rather than a strategy, and it is the
 * one place in the drill that keeps one. A `node_path` step is an OPEN
 * vocabulary — a source author writes the line the hand took — so there is no
 * closed union to be total over the way `SLOT_LABEL` and its neighbours are.
 * An unmapped step is still somebody's word for something, so it is printed
 * with its underscores softened rather than dropped.
 */

/** A step as past-tense words, with the street it happened on. */
export function describeStep(step: string, words: DrillWords = ENGLISH_WORDS): { street?: Street | undefined; text: string } {
    const parsed = parseStep(step);
    const verb = words.past[parsed.action] ?? parsed.action.replace(/_/g, ' ');
    if (parsed.actor === undefined) return { street: parsed.street, text: parsed.action.replace(/_/g, ' ') };
    return { street: parsed.street, text: words.say.step(parsed.actor === 'hero' ? 'hero' : 'villain', verb) };
}
