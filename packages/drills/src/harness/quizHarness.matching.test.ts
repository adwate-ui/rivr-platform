import { describe, it, expect } from 'vitest';
import type { OntologyPayload, Principle, QuizHand, SituationInstance } from '../ontology/types.ts';
import {
    runHarness, bracketForStack, villainTypeFromNotes, admitsQuizHand, missedCoordinates, nearestMiss,
} from './quizHarness.ts';
import { betPrinciple, fixturePayload, FLOP_HAND, quizHand, readSpot, TURN_HAND } from './fixtures.ts';

/**
 * Strict matching: what a quiz hand states, what it does not, and which
 * coordinate kept a principle out.
 */

const principle = (over: Partial<Principle> = {}): Principle =>
    betPrinciple('pr_always_bet', { street: 'flop' }, { name: 'Always bet', ...over });

const quiz = (instance: SituationInstance = FLOP_HAND, over: Partial<QuizHand> = {}): QuizHand =>
    quizHand('q1', instance, over);

const payload = (over: Partial<OntologyPayload> = {}): OntologyPayload =>
    fixturePayload({ principles: [principle()], quiz_hands: [quiz()], ...over });

describe('reading what the hand does state', () => {
    const source = payload();

    it('brackets a stated stack by THIS source\'s own boundaries', () => {
        const brackets = { ...source.source, stack_brackets: { short_max: 50, standard_max: 120, deep_max: 250 } };
        expect(bracketForStack(40, brackets)).toBe('short');
        expect(bracketForStack(100, brackets)).toBe('standard');
        expect(bracketForStack(200, brackets)).toBe('deep');
        expect(bracketForStack(400, brackets)).toBe('very_deep');
    });

    it('says nothing when the stack or the brackets are absent', () => {
        expect(bracketForStack(undefined, source.source)).toBeUndefined();
        expect(bracketForStack(100, { id: 'x', title: 'x', kind: 'book' })).toBeUndefined();
    });

    it('reads an opponent type out of villain_notes when the encoder used an id', () => {
        const withTypes = payload({ opponent_types: [{ id: 'opp_nit', label: 'Nit', canonical_archetype: 'nit' }] });
        expect(villainTypeFromNotes('opp_nit', withTypes)).toBe('opp_nit');
        expect(villainTypeFromNotes(' opp_nit ', withTypes)).toBe('opp_nit');
        expect(villainTypeFromNotes('a tight guy', withTypes)).toBeUndefined();
        expect(villainTypeFromNotes(undefined, withTypes)).toBeUndefined();
    });
});

describe('matching strictly', () => {
    const spot = readSpot(quiz());

    it('excludes a principle for a coordinate the hand never stated', () => {
        // An omitted coordinate means UNKNOWN, not wildcard. Treating absence as
        // a match only moves hands to whichever broad rule was declared first,
        // and it inflates the rate silently.
        expect(admitsQuizHand(spot, { postflop_facing_state: ['facing_bet'] })).toBe(false);
        expect(admitsQuizHand(spot, { pot_type: ['three_bet'] })).toBe(false);
        expect(admitsQuizHand(spot, { player_count: ['multiway'] })).toBe(false);
        expect(admitsQuizHand(spot, { villain_raise_size: ['large'] })).toBe(false);
        expect(admitsQuizHand(spot, { preflop_facing_state: ['unopened'] })).toBe(false);
    });

    it('admits on a coordinate the hand DID state', () => {
        const stated = readSpot(quiz({
            hero_cards: ['Ah', 'Kd'],
            board: ['2c', '7d', 'Ts'],
            hero_position: 'BTN',
            pot_type: 'three_bet',
            player_count: 'heads_up',
            postflop_facing_state: 'facing_bet',
        }));
        expect(admitsQuizHand(stated, { pot_type: ['three_bet'] })).toBe(true);
        expect(admitsQuizHand(stated, { player_count: ['heads_up'] })).toBe(true);
        expect(admitsQuizHand(stated, { postflop_facing_state: ['facing_bet'] })).toBe(true);
        expect(admitsQuizHand(stated, { pot_type: ['limped'] })).toBe(false);
    });

    it('prefers an explicit villain_type_id over the prose notes', () => {
        const source = payload({
            opponent_types: [
                { id: 'opp_nit', label: 'Nit', canonical_archetype: 'nit' },
                { id: 'opp_fish', label: 'Fish', canonical_archetype: 'calling_station' },
            ],
        });
        const stated = readSpot(quiz({ hero_cards: ['Ah', 'Kd'], villain_notes: 'opp_nit', villain_type_id: 'opp_fish' }), source);
        expect(stated.villainType).toBe('opp_fish');
    });

    it('still excludes on a coordinate the hand DID state', () => {
        // The board states the street, so this is a real disagreement rather
        // than an absence.
        expect(admitsQuizHand(spot, { street: ['river'] })).toBe(false);
        expect(admitsQuizHand(spot, { street: ['flop'] })).toBe(true);
    });

    it('does not default an unstated hero position', () => {
        // A default is a guess: it would match every position-scoped principle
        // to a hand whose position nobody recorded.
        const noPosition = readSpot(quiz({ hero_cards: ['Ah', 'Kd'] }));
        expect(noPosition.heroPosition).toBeUndefined();
        expect(admitsQuizHand(noPosition, { hero_position: ['BTN'] })).toBe(false);
    });

    it('honours a stated stack bracket', () => {
        const withStack = readSpot(
            quiz({ hero_cards: ['Ah', 'Kd'], effective_stack_bb: 400 }),
            payload({ source: { id: 'src', title: 'x', kind: 'book', stack_brackets: { deep_max: 250 } } }),
        );
        expect(admitsQuizHand(withStack, { stack_bracket: ['very_deep'] })).toBe(true);
        expect(admitsQuizHand(withStack, { stack_bracket: ['short'] })).toBe(false);
    });
});

describe('naming what kept a spot out', () => {
    const spot = readSpot(quiz({ ...FLOP_HAND, hero_position: 'BTN', pot_type: 'single_raised' }));

    it('separates a disagreement from something the hand never stated', () => {
        // The two take different fixes: one encoding is wrong, versus the fact
        // was never written down anywhere.
        expect(missedCoordinates(spot, { pot_type: ['three_bet'] })).toEqual(['pot_type=single_raised']);
        expect(missedCoordinates(spot, { villain_raise_size: ['large'] })).toEqual(['villain_raise_size=UNSTATED']);
        // A river exclusion reads the turn card too (1.8): a flush that got
        // there on the turn is a miss for "the draws never completed".
        expect(missedCoordinates(
            { ...spot, runouts: ['brick'], priorRunouts: ['flush_completing'] },
            { runout_exclude: ['flush_completing'] },
        )).toEqual(['runout_exclude:flush_completing']);
        // A preflop spot has no draws at all, not an empty list of them.
        const preflop = readSpot(quiz({ hero_cards: ['Ah', 'Kd'] }));
        expect(missedCoordinates(preflop, { draw_class_any: ['flush_draw'] })).toEqual(['draw_class_any=UNSTATED']);
    });

    it('checks every constrainable slot, not the handful a fixture happens to set', () => {
        // A slot missing from the reader table is invisible: it never blocks
        // anything, and the miss report quietly under-counts.
        const everything = missedCoordinates(spot, {
            street: ['river'],
            hero_position: ['SB'],
            villain_position: ['BB'],
            pot_type: ['three_bet'],
            player_count: ['multiway'],
            stack_bracket: ['short'],
            preflop_facing_state: ['unopened'],
            postflop_facing_state: ['facing_bet'],
            villain_raise_size: ['large'],
            villain_types: ['opp_nit'],
            hand_class_any: ['set'],
            draw_class_any: ['flush_draw'],
            relative_strength_any: ['nuts'],
        });
        expect(everything).toHaveLength(13);
        expect(everything).toContain('street=flop');
        expect(everything).toContain('villain_position=UNSTATED');
        // A postflop spot always HAS a draw classification, so this one
        // disagrees rather than being unstated.
        expect(everything).toContain(`draw_class_any=${String(spot.draws?.[0])}`);
    });

    it('says nothing about a coordinate the situation does not constrain', () => {
        expect(missedCoordinates(spot, { street: ['flop'], hero_position: ['BTN'] })).toEqual([]);
        // An empty list constrains nothing either; stage 4 reports that shape.
        expect(missedCoordinates(spot, { pot_type: [] })).toEqual([]);
    });

    it('reports a required tag the board lacks and an excluded tag it has', () => {
        expect(missedCoordinates(spot, { board_require: ['monotone'] })).toEqual(['board_require:monotone']);
        expect(missedCoordinates(spot, { board_exclude: spot.boardTags.slice(0, 1) }))
            .toEqual([`board_exclude:${String(spot.boardTags[0])}`]);
    });

    it('picks the principle that missed by the least', () => {
        const rule = (situation: Principle['rule']['situation']): Principle['rule'] => ({
            kind: 'predicate', situation, branches: [], default: { action: 'bet' },
        });
        const miss = nearestMiss(spot, [
            principle({ id: 'far', rule: rule({ street: 'flop', pot_type: ['three_bet'], hero_position: ['SB'] }) }),
            principle({ id: 'near', rule: rule({ street: 'flop', pot_type: ['three_bet'] }) }),
        ]);
        expect(miss?.principleId).toBe('near');
        expect(miss?.blockedBy).toEqual(['pot_type=single_raised']);
    });

    it('ignores principles on another street entirely, and concept principles', () => {
        // A river rule is not a near miss for a flop spot, and letting it
        // compete buries the real neighbours.
        expect(nearestMiss(spot, [principle({
            id: 'river_rule',
            rule: { kind: 'predicate', situation: { street: 'river' }, branches: [], default: { action: 'check' } },
        })])).toBeUndefined();
        expect(nearestMiss(spot, [])).toBeUndefined();
        expect(nearestMiss(spot, [principle({ id: 'concept', drillable: false })])).toBeUndefined();
    });

    it('attaches the miss to the unmatched result the harness reports', () => {
        const report = runHarness(payload({
            principles: [principle({
                rule: {
                    kind: 'predicate', situation: { street: 'flop', pot_type: ['three_bet'] },
                    branches: [], default: { action: 'bet', sizing: 'medium' },
                },
            })],
            quiz_hands: [quiz({ ...FLOP_HAND, pot_type: 'limped' })],
        }));
        expect(report.results[0]?.verdict).toBe('no-principle');
        expect(report.results[0]?.nearestMiss?.blockedBy).toEqual(['pot_type=limped']);
    });
});

describe('missed coordinates on the newest slots', () => {
    const turnSpot = readSpot(quiz({ ...TURN_HAND, board: ['Qs', '7c', '2d', 'Th'], spr_bracket: 'low' }));

    it('reports the runout value that kept a brick-scoped rule out', () => {
        // The T on Q-7-2 brings straight draws, so a rule wanting bricks names
        // exactly what it saw instead.
        expect(missedCoordinates(turnSpot, { runout_any: ['brick'] })).toContain('runout_any=straight_drawing');
    });

    it('reports the excluded draw the hand holds', () => {
        // A-K on Q-7-2-T holds a gutshot; a rule for hands with no real draw
        // names exactly that.
        expect(missedCoordinates(turnSpot, { draw_class_exclude: ['gutshot'] })).toContain('draw_class_exclude:gutshot');
        expect(missedCoordinates(turnSpot, { draw_class_exclude: ['flush_draw'] }))
            .not.toContain('draw_class_exclude:flush_draw');
    });

    it('reports the excluded runout tag the card carried', () => {
        expect(missedCoordinates(turnSpot, { runout_exclude: ['straight_drawing'] }))
            .toContain('runout_exclude:straight_drawing');
        expect(missedCoordinates(turnSpot, { runout_exclude: ['flush_completing'] }))
            .not.toContain('runout_exclude:flush_completing');
    });

    it('carries the seat of the opponent only where the hand states it', () => {
        // A hand that names the seat of the player who bet into the hero.
        const stated = readSpot(quiz({ hero_cards: ['Jh', 'Jd'], board: ['Kc', '8c', '5s'], villain_position: 'BTN' }));
        expect(stated.villainPosition).toBe('BTN');
        expect(stated.villainPositions).toEqual(['BTN']);
        expect(missedCoordinates(stated, { villain_position: ['BTN'] })).toEqual([]);
        expect(missedCoordinates(turnSpot, { villain_position: ['BTN'] })).toContain('villain_position=UNSTATED');
    });

    it('reports a mismatched stack-to-pot bracket', () => {
        expect(missedCoordinates(turnSpot, { spr_bracket: ['high'] })).toEqual(['spr_bracket=low']);
    });

    it('says UNSTATED for a runout constraint on a flop spot: three cards at once are nobody\'s runout', () => {
        expect(missedCoordinates(readSpot(quiz()), { runout_any: ['brick'] })).toEqual(['runout_any=UNSTATED']);
    });
});
