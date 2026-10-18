import { describe, it, expect } from 'vitest';
import { DECK, type Card, cardOrThrow as card, cardsOrThrow as cards } from './cards/cards.ts';
import { makeRng } from './prng.ts';
import { describeScenario, describeShort, potLabel, stackLabel, describeCard, describeCards } from './describeScenario.ts';
import type { Scenario } from './generator/types.ts';

/** A formatter a test can read at a glance: the amount and nothing else. */
const money = (amount: number): string => `M${amount}`;
const describeSpot = (spot: Scenario): string => describeScenario(spot, money);

/**
 * The scenario, in prose.
 *
 * These read like presentation tests and are not. For every other chart in this
 * app the `aria-label` summarises figures that also live in a table; here the
 * drawing IS the question, so this text is the only way a reader using a screen
 * reader can answer at all. A missing board or an unspoken facing state is a
 * drill that cannot be completed, not a cosmetic gap.
 */

const pair = (notation: string): [Card, Card] => [card(notation.slice(0, 2)), card(notation.slice(2, 4))];

const scenario = (over: Partial<Scenario> = {}): Scenario => ({
    street: 'flop',
    heroPosition: 'CO',
    villainPosition: 'BB',
    potType: 'single_raised',
    playerCount: 'heads_up',
    villainPositions: ['BB'],
    effectiveStackBb: 100,
    stackBracket: 'standard',
    postflopFacingState: 'facing_check',
    board: cards('AhKd7c'),
    hole: pair('QsQh'),
    holder: 'hero',
    boardTags: [],
    nodePath: [],
    seed: 1,
    ...over,
});

describe('naming a card', () => {
    it('spells it out, because "Ah" is read aloud as a word', () => {
        expect(describeCard(card('Ah'))).toBe('ace of hearts');
        expect(describeCard(card('Ts'))).toBe('ten of spades');
    });

    it('lists several in order', () => {
        expect(describeCards(cards('AhKd'))).toBe('ace of hearts, king of diamonds');
    });
});

describe('describing a spot', () => {
    it('carries everything needed to answer it', () => {
        const text = describeSpot(scenario());
        expect(text).toContain('Flop');
        expect(text).toContain('the cutoff');
        expect(text).toContain('a standard stack');
        expect(text).toContain('a single-raised pot');
        expect(text).toContain('heads up');
        expect(text).toContain('ace of hearts, king of diamonds, seven of clubs');
        expect(text).toContain('queen of spades, queen of hearts');
        expect(text).toContain('It is checked to you.');
    });

    it('says what the turn card changed — rules key on it, so the question must too', () => {
        const text = describeSpot(scenario({
            street: 'turn',
            board: cards('AhKd7c2s'),
            runouts: ['brick'],
        }));
        expect(text).toContain('The turn card changes little.');
    });

    it('says what the river card changed, joining several changes into one sentence', () => {
        const text = describeSpot(scenario({
            street: 'river',
            board: cards('Jh8c3dQsKs'),
            runouts: ['overcard', 'flush_drawing'],
        }));
        expect(text).toContain('The river card is an overcard and adds a flush draw.');
    });

    it('speaks every runout tag the classifier can emit', () => {
        for (const tag of ['pairs_board', 'pairs_hero', 'flush_completing', 'four_flush',
            'straight_completing', 'straight_completing_low', 'straight_drawing', 'four_straight'] as const) {
            const text = describeSpot(scenario({
                street: 'turn',
                board: cards('AhKd7c2s'),
                runouts: [tag],
            }));
            expect(text).toContain('The turn card ');
        }
    });

    it('stays quiet about the runout on a flop, and when the scenario carries none', () => {
        expect(describeSpot(scenario())).not.toContain('The turn card');
        expect(describeSpot(scenario({
            street: 'turn',
            board: cards('AhKd7c2s'),
            runouts: [],
        }))).not.toContain('The turn card');
    });

    it('omits the board preflop rather than announcing an empty one', () => {
        const text = describeSpot(scenario({
            street: 'preflop',
            board: [],
            postflopFacingState: undefined,
            preflopFacingState: 'unopened',
        }));
        expect(text).not.toContain('Board:');
        expect(text).toContain('The pot is unopened.');
        expect(text).toContain('Your hand:');
    });

    it('does not call an unopened pot a kind of pot, nor count company that is not there', () => {
        // It used to say "in a limped pot, three-way ... The pot is unopened." —
        // a description that contradicted itself inside one breath.
        const text = describeSpot(scenario({
            street: 'preflop', board: [], potType: undefined, playerCount: 'three_way',
            postflopFacingState: undefined, preflopFacingState: 'unopened',
        }));
        expect(text).toContain('with a standard stack. Your hand:');
        expect(text).toContain('The pot is unopened.');
        expect(text).not.toContain('three-way');
        expect(text).not.toContain(' pot,');
    });

    it('says who acted, once the encoding does (ontology 1.7)', () => {
        const text = describeSpot(scenario({
            nodePath: ['hero_flop_bet', 'villain_flop_call'],
        }));
        expect(text).toContain('Action so far: you bet the flop, then they called the flop.');
        // A 1.6 path without actors still reads as the bare actions.
        expect(describeSpot(scenario({ nodePath: ['flop_bet', 'flop_call'] })))
            .toContain('Action so far: bet the flop, then call the flop.');
    });

    it('names every position, stack, pot type and player count it can be handed', () => {
        const positions = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
        positions.forEach((heroPosition) => {
            expect(describeSpot(scenario({ heroPosition }))).not.toContain('undefined');
        });

        (['short', 'standard', 'deep', 'very_deep'] as const).forEach((stackBracket) => {
            expect(describeSpot(scenario({ stackBracket }))).not.toContain('undefined');
        });

        (['limped', 'single_raised', 'three_bet', 'four_bet_plus'] as const).forEach((potType) => {
            expect(describeSpot(scenario({ potType }))).not.toContain('undefined');
        });

        (['heads_up', 'three_way', 'multiway'] as const).forEach((playerCount) => {
            expect(describeSpot(scenario({ playerCount }))).not.toContain('undefined');
        });
    });

    it('speaks every facing state, on both sides of the flop', () => {
        ([
            'unopened', 'facing_limp', 'facing_raise', 'facing_raise_and_call',
            'facing_3bet', 'facing_4bet', 'facing_steal',
        ] as const).forEach((preflopFacingState) => {
            const text = describeSpot(scenario({
                street: 'preflop', board: [], postflopFacingState: undefined, preflopFacingState,
            }));
            expect(text).not.toContain('undefined');
            expect(text.endsWith('.')).toBe(true);
        });

        ([
            'first_to_act', 'facing_check', 'facing_bet', 'facing_raise', 'facing_donk',
        ] as const).forEach((postflopFacingState) => {
            expect(describeSpot(scenario({ postflopFacingState }))).not.toContain('undefined');
        });
    });

    it('says nothing about a facing state the scenario does not have', () => {
        const text = describeSpot(scenario({ postflopFacingState: undefined }));
        expect(text).not.toContain('undefined');
        expect(text).toContain('Your hand:');
    });

    it('names every street', () => {
        (['preflop', 'flop', 'turn', 'river'] as const).forEach((street) => {
            const board = street === 'preflop' ? [] : cards('AhKd7c').slice(0, 3);
            expect(describeSpot(scenario({ street, board }))).not.toContain('undefined');
        });
    });

    it('never leaves a gap for any hand the deck can deal', () => {
        const rng = makeRng(77);
        for (let trial = 0; trial < 200; trial += 1) {
            const drawn = rng.shuffle(DECK).slice(0, 7);
            const text = describeSpot(scenario({
                board: cards(drawn.slice(0, 5).join('')),
                hole: pair(drawn.slice(5, 7).join('')),
                holder: 'hero',
                street: 'river',
            }));
            expect(text).not.toContain('undefined');
            expect(text.length).toBeGreaterThan(60);
        }
    });
});

describe('the pot and the stack', () => {
    it('are said in the caller currency and in blinds, the pot as an estimate, and only where the spot has them', () => {
        // Money comes from the caller's formatter, so the product writes one
        // currency; the stakes label still says which game it is.
        expect(potLabel(scenario({ potBb: 20, stakes: '2/5' }), money)).toBe('about M100 · 20bb');
        expect(potLabel(scenario({ potBb: 20, stakes: undefined }), money)).toBe('about 20bb');
        expect(potLabel(scenario({ potBb: undefined }), money)).toBeUndefined();
        expect(describeSpot(scenario({ potBb: 20, stakes: '2/5' }))).toMatch(/About M100 · 20bb in the middle\./);
        expect(stackLabel(scenario({ effectiveStackBb: 120, stakes: '2/5' }), money)).toBe('M600 · 120bb');
        expect(stackLabel(scenario({ effectiveStackBb: 120, stakes: undefined }), money)).toBe('120bb');
        expect(stackLabel(scenario({ effectiveStackBb: undefined }), money)).toBeUndefined();
    });
});

describe('the short form', () => {
    it('is a heading, not a sentence', () => {
        expect(describeShort(scenario())).toBe('Flop · CO · a single-raised pot');
    });

    it('leaves the pot out of an unopened preflop heading — it is not yet any kind of pot', () => {
        expect(describeShort(scenario({ street: 'preflop', potType: undefined, preflopFacingState: 'unopened' })))
            .toBe('Preflop · CO');
    });
});

describe('the coordinates a rule decided on', () => {
    /**
     * A reader cannot be graded on a question they cannot see. Stakes, bet size
     * and stack-to-pot were all sampled, all matched, all used to pick the
     * governing principle — and all spoken nowhere, so a screen-reader user was
     * being asked a question with its premise missing.
     */
    it('names the game first, because the answer can depend on it', () => {
        expect(describeSpot(scenario({ stakes: '2/5' }))).toMatch(/^A 2\/5 game\./);
    });

    it('says nothing about the game when the spot never stated one', () => {
        // Unstated stays unstated. Inventing "1/2" would be inventing the
        // premise the rest of the sentence depends on.
        expect(describeSpot(scenario({ stakes: undefined }))).not.toMatch(/game\./);
    });

    it('says how big the bet in front of you is', () => {
        expect(describeSpot(scenario({
            postflopFacingState: 'facing_bet',
            villainRaiseSize: 'all_in',
        }))).toContain('The bet is all in');
    });

    it('says how much is behind relative to the pot', () => {
        expect(describeSpot(scenario({ sprBracket: 'very_low' })))
            .toContain('The pot is large next to what is behind');
    });

    it('puts the game in the short heading too', () => {
        expect(describeShort(scenario({ stakes: '5/10' }))).toMatch(/^5\/10 · /);
        expect(describeShort(scenario({ stakes: undefined }))).not.toContain('·  ');
    });
});

describe('whose cards these are', () => {
    /*
     * A classify rule may ask about the OPPONENT's holding. The caption is the
     * whole question for a reader using a screen reader, so telling them a hand
     * is theirs when it is not makes the spot unanswerable in a way they cannot
     * see — they would answer about a hand they were never dealt.
     */
    it('says the hand is yours by default', () => {
        expect(describeSpot(scenario())).toContain('Your hand:');
    });

    it('says it is the opponent’s when the question is about their holding', () => {
        const spoken = describeSpot(scenario({ holder: 'villain' }));
        expect(spoken).toContain("Your opponent's hand:");
        expect(spoken).not.toContain('Your hand:');
    });
});
