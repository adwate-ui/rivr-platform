import { describe, it, expect } from 'vitest';
import type { OntologyPayload, QuizHand } from '../ontology/types.ts';
import { answerLeaves, baseRates, claimVolume } from './diagnostics.ts';
import {
    betPrinciple, fixturePayload, FLOP_HAND, quizHand, readSpot, withoutQuizHands,
} from './fixtures.ts';

/**
 * The diagnostics that come BEFORE editing any rule: the floor and the claim
 * volume. Every number here exists to stop a plausible-looking accuracy figure
 * being read as good news. A floor says what guessing scores; a claim count says
 * which rules answer spots they cannot judge.
 */

/** Flop, first to act, so the pad offers check and bet. */
const quiz = (id: string, over: Partial<QuizHand> = {}): QuizHand => quizHand(id, {
    ...FLOP_HAND, hero_position: 'BTN', pot_type: 'single_raised', postflop_facing_state: 'first_to_act',
}, over);

const payload = (over: Partial<OntologyPayload> = {}): OntologyPayload => fixturePayload({
    principles: [betPrinciple('wide', { street: ['flop'] })],
    quiz_hands: [quiz('q1')],
    ...over,
});

const answering = (...hands: QuizHand[]) => baseRates(payload({ quiz_hands: hands }));

describe('what a reader can actually answer', () => {
    it('offers check and bet when nobody has bet, with sizings on the bet', () => {
        const leaves = answerLeaves(readSpot(quiz('a')));
        // check, plus bet at four sizings.
        expect(leaves).toHaveLength(5);
        expect(leaves.filter((leaf) => leaf.action === 'check')).toHaveLength(1);
        expect(leaves.filter((leaf) => leaf.action === 'bet')).toHaveLength(4);
    });

    it('offers fold, call and raise when facing a bet', () => {
        const leaves = answerLeaves(readSpot(quiz('a', {
            situation_instance: { ...FLOP_HAND, postflop_facing_state: 'facing_bet' },
        })));
        // fold, call, plus raise at four sizings.
        expect(leaves).toHaveLength(6);
        expect(leaves.map((leaf) => leaf.action)).toContain('fold');
    });
});

describe('base rates', () => {
    it('reports what always answering the commonest action would score', () => {
        // Three folds, two bets: a rule that reads nothing and says fold scores
        // 60% without encoding anything at all.
        const fold = { author_answer: { action: 'fold' } } as const;
        const rates = answering(quiz('a', fold), quiz('b', fold), quiz('c', fold), quiz('d'), quiz('e'));
        expect(rates.modalAction).toBe('fold');
        expect(rates.modalActionRate).toBeCloseTo(0.6);
        expect(rates.actionCounts[0]).toEqual({ action: 'fold', hands: 3 });
    });

    it('breaks a tie between equally common actions by name, so it does not wander', () => {
        expect(answering(quiz('a', { author_answer: { action: 'raise' } }), quiz('b')).modalAction).toBe('bet');
    });

    it('computes the guessing floor from the real choice set, not a nominal one', () => {
        // One of five leaves is bet:medium.
        expect(baseRates(payload()).uniformRandomFloor).toBeCloseTo(1 / 5);
    });

    it('makes a hand easier to guess when the source left the sizing open', () => {
        // All four bet leaves grade correct when no sizing was stated.
        expect(answering(quiz('a', { author_answer: { action: 'bet' } })).uniformRandomFloor).toBeCloseTo(4 / 5);
    });

    it('treats an explicitly unspecified sizing the same as an absent one', () => {
        const rates = answering(quiz('a', { author_answer: { action: 'bet', sizing: 'unspecified' } }));
        expect(rates.uniformRandomFloor).toBeCloseTo(4 / 5);
    });

    it('names a source answer the pad has no action for, in any state', () => {
        // `all_in` is an ACTION in the ontology and only a SIZING in the pad.
        const rates = answering(quiz('a', { author_answer: { action: 'all_in', sizing: 'all_in' } }));
        expect(rates.unexpressibleAnswers).toEqual([{ quizId: 'a', action: 'all_in' }]);
        expect(rates.contradictoryAnswers).toEqual([]);
    });

    it('separates a hand that contradicts itself from one the pad cannot express', () => {
        // `fold` is a perfectly good action, just not one offered to a hand
        // that records itself as first to act. The hand describes two spots.
        const rates = answering(quiz('a', { author_answer: { action: 'fold' } }));
        expect(rates.unexpressibleAnswers).toEqual([]);
        expect(rates.contradictoryAnswers).toEqual([{ quizId: 'a', action: 'fold', facingState: 'not facing a bet' }]);
    });

    it('reports the floor over answerable hands as well as over all of them', () => {
        // The plain floor is dragged down by the hand nothing can get right,
        // which would flatter an accuracy figure compared against it.
        const rates = answering(quiz('a'), quiz('b', { author_answer: { action: 'all_in' } }));
        expect(rates.uniformRandomFloor).toBeCloseTo(0.1);
        expect(rates.uniformRandomFloorAnswerable).toBeCloseTo(0.2);
    });

    it('leaves indeterminate hands out, and copes with a corpus of nothing', () => {
        expect(answering(quiz('a', { indeterminate: true })).modalAction).toBeNull();
        expect(answering()).toMatchObject({ uniformRandomFloor: 0, uniformRandomFloorAnswerable: 0, modalActionRate: 0 });
    });

    it('skips a hand it cannot read rather than counting it as unguessable', () => {
        const rates = answering(quiz('bad', { situation_instance: { hero_cards: ['Ah'] } }));
        expect(rates.unexpressibleAnswers).toEqual([]);
        expect(rates.uniformRandomFloor).toBe(0);
    });

    it('catches the contradiction in the other direction too', () => {
        // Facing a bet, answering "bet". The pad offers fold/call/raise there,
        // so this hand also describes two spots.
        const rates = answering(quiz('a', {
            situation_instance: { ...FLOP_HAND, postflop_facing_state: 'facing_bet' },
            author_answer: { action: 'bet', sizing: 'medium' },
        }));
        expect(rates.contradictoryAnswers).toEqual([{ quizId: 'a', action: 'bet', facingState: 'facing a bet' }]);
    });

    it('copes with a source that has no quiz_hands array at all', () => {
        expect(baseRates(withoutQuizHands(payload())).modalAction).toBeNull();
    });
});

describe('claim volume', () => {
    it('counts the hands a principle is a candidate for, and what it governs', () => {
        const volumes = claimVolume(payload({
            principles: [
                betPrinciple('wide', { street: ['flop'] }),
                betPrinciple('narrow', { street: ['flop'], hero_position: ['BTN'] }),
            ],
            quiz_hands: [quiz('a'), quiz('b')],
        }));
        // Both claim both hands; arbitration gives both to the narrower one.
        // The WIDE rule sorts first at equal claim count: claiming everything
        // while constraining nothing is the profile worth looking at.
        expect(volumes).toEqual([
            { principleId: 'wide', handsClaimed: 2, width: 0, handsGoverned: 0 },
            { principleId: 'narrow', handsClaimed: 2, width: 1, handsGoverned: 2 },
        ]);
    });

    it('sorts the widest claim first, then the lowest width: the risk profile', () => {
        const volumes = claimVolume(payload({
            principles: [
                betPrinciple('narrow_high_claim', { street: ['flop'], hero_position: ['BTN'] }),
                betPrinciple('wide_high_claim', { street: ['flop'] }),
                betPrinciple('never_claims', { street: ['river'] }),
            ],
        }));
        expect(volumes.map((entry) => entry.principleId))
            .toEqual(['wide_high_claim', 'narrow_high_claim', 'never_claims']);
    });

    it('leaves concept principles out, since they never govern a decision', () => {
        const volumes = claimVolume(payload({
            principles: [betPrinciple('concept', { street: ['flop'] }, { drillable: false })],
        }));
        expect(volumes).toEqual([]);
    });

    it('skips a hand it cannot read, and a source with no quiz hands', () => {
        expect(claimVolume(payload({
            quiz_hands: [quiz('bad', { situation_instance: { hero_cards: ['Ah'] } })],
        }))[0]?.handsClaimed).toBe(0);
        expect(claimVolume(withoutQuizHands(payload()))[0]?.handsClaimed).toBe(0);
    });

    it('breaks a full tie by id, so the order does not wander between runs', () => {
        const volumes = claimVolume(payload({
            principles: [
                betPrinciple('zulu', { street: ['flop'], hero_position: ['BTN'] }),
                betPrinciple('alpha', { street: ['flop'], hero_position: ['BTN'] }),
            ],
        }));
        expect(volumes.map((entry) => entry.principleId)).toEqual(['alpha', 'zulu']);
    });
});
