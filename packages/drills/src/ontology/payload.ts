/**
 * The encoding as a whole: a source, its principles, ranges and quiz hands.
 */
import type {
    AnswerKind, Confidence, GameTexture, OntologyVersion, PlayerCount, Position, PostflopFacingState, PotType,
    PreflopFacingState, PrincipleStatus, ProvenanceForm, ProvenanceKind, SourceKind, SourceState, SprBracket,
    StackBracket, Stakes, Street, VillainArchetype, VillainRaiseSize,
} from './vocabulary.ts';
import type { Feedback, Outcome, Rule, Situation } from './rules.ts';

export interface RangeSet {
    id: string;
    label?: string;
    hands: string[];
    derived_from?: string;
    excludes?: string[];
}

/** A quiz hand whose source gave a reading: the id of the label (1.9). */
export interface AuthorLabel {
    kind: 'classify';
    label: string;
}

/**
 * A quiz hand whose source gave a number (2.0). `tolerance` is the source's own
 * hedge ("about 60"), never how close the encoding came.
 */
export interface AuthorCount {
    kind: 'count';
    value: number;
    tolerance?: number;
}

/** The source's answer, in the vocabulary of the question. An action answer carries no `kind`. */
export type AuthorAnswer = Outcome | AuthorLabel | AuthorCount;

/** What kind of question a quiz hand's answer answers. No answer reads as an action. */
export function answerKindOfAnswer(answer: AuthorAnswer | undefined): AnswerKind {
    return answer !== undefined && 'kind' in answer ? answer.kind : 'action';
}

/** Modifiers substitute; they do not transform. See the schema's `effect`. */
export interface Modifier {
    id: string;
    label?: string;
    when: { game_texture?: GameTexture; stack_bracket?: StackBracket[] };
    effect: { substitute_range_set_id?: string; substitute_outcome?: Outcome };
}

export interface Exception {
    when: Situation;
    then: Outcome;
    note?: string;
}

export interface Principle {
    id: string;
    source_id: string;
    source_unit_id?: string;
    page_ref?: number | string;
    name: string;
    tier?: string;
    prerequisites?: string[];
    rule: Rule;
    /** Evaluated before the base rule. First match wins. */
    exceptions?: Exception[];
    modifiers?: Modifier[];
    rationale: string;
    feedback: Feedback;
    confidence?: Confidence;
    status?: PrincipleStatus;
    /** Supersedes `rule` and `exceptions` where the user overrode the source. */
    override_rule?: Rule;
    drillable?: boolean;
}

export interface OpponentType {
    id: string;
    label: string;
    aliases?: string[];
    canonical_archetype: VillainArchetype;
    behavioural_tags?: string[];
}

export interface QuizProvenance {
    kind: ProvenanceKind;
    form: ProvenanceForm;
}

/**
 * The coordinates a quiz hand states. An omitted one means unknown, never a
 * wildcard: a hand that does not state its pot type must not match a principle
 * that constrains pot type, or the pass rate inflates silently.
 */
export interface SituationInstance {
    stakes?: Stakes;
    effective_stack_bb?: number;
    hero_position?: Position;
    hero_cards?: string[];
    board?: string[];
    action_log?: string[];
    /** Free prose. `villain_type_id` is the machine-matchable form. */
    villain_notes?: string;
    street?: Street;
    pot_type?: PotType;
    player_count?: PlayerCount;
    preflop_facing_state?: PreflopFacingState;
    postflop_facing_state?: PostflopFacingState;
    villain_raise_size?: VillainRaiseSize;
    spr_bracket?: SprBracket;
    /** The seat of the opponent whose action is being answered (1.7). */
    villain_position?: Position;
    villain_type_id?: string;
    /** The table's character, which drives `modifiers`. Unknown fires no modifier. */
    game_texture?: GameTexture;
}

export interface QuizHand {
    id: string;
    source_id: string;
    page_ref?: number | string;
    /** Where the hand came from. Omitted means unstated, read as in-sample. */
    provenance?: QuizProvenance;
    situation_instance: SituationInstance;
    /**
     * What the source says to do, or the reading or count it gives. Absent only
     * on an `indeterminate` hand: an answer invented for a hand the source never
     * answered would measure the encoding against itself.
     */
    author_answer?: AuthorAnswer;
    /** Why an indeterminate hand cannot be scored, written from the source. */
    indeterminate_reason?: string;
    /** Source gives no single answer. Excluded from pass-rate scoring. */
    indeterminate?: boolean;
}

export interface Source {
    id: string;
    title: string;
    author?: string;
    kind: SourceKind;
    state?: SourceState;
    /** Date the state last changed (YYYY-MM-DD). Gates warn when a non-active state lasts past 30 days. */
    state_changed_on?: string;
    table_size?: number;
    position_map?: Record<string, string>;
    stack_brackets?: { short_max?: number; standard_max?: number; deep_max?: number };
    /** Stack-to-pot boundaries as this source means them (1.4). */
    spr_brackets?: { very_low_max?: number; low_max?: number; medium_max?: number };
    /**
     * A preflop raise as a multiple of the pot it raises into, not of the big
     * blind. Live opens are often several big blinds; measured against the pot
     * they read as standard, while a blind reading would file them as large.
     */
    raise_size_brackets?: { small_max?: number; standard_max?: number };
    /**
     * A postflop bet as a fraction of the pot (1.7), the same buckets whichever
     * side makes it, so the drill's Small / Medium / Large mean something.
     */
    bet_size_brackets?: { small_max?: number; standard_max?: number };
    sizing_map?: { small?: number; medium?: number; large?: number };
    /** Set before the first validation run. Below this, the source does not activate. */
    quiz_pass_threshold?: number;
}

/**
 * A chapter, skill or section of the source (1.6), so a reader can drill one
 * part at a time in the source's own order.
 */
export interface SourceUnit {
    readonly id: string;
    /** As the source names it, so the drill uses the reader's vocabulary. */
    readonly label: string;
    /** Where it sits in the source, for ordering the list. */
    readonly order: number;
    readonly page_ref?: number | string;
}

export interface OntologyPayload {
    /** Any version the schema still accepts, not just the newest. */
    ontology_version: OntologyVersion;
    source: Source;
    opponent_types: OpponentType[];
    range_sets: RangeSet[];
    principles: Principle[];
    /** Chapters or skills, for drilling one at a time (1.6). */
    source_units?: SourceUnit[];
    quiz_hands?: QuizHand[];
}
