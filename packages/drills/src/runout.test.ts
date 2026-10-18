import { describe, it, expect } from 'vitest';
import { DECK_CARDS, cardOrThrow as one, cardsOrThrow as cards, type Card } from './cards/cards.ts';
import { RUNOUT_TAGS, type RunoutTag } from './ontology/types.ts';
import { boardTags } from './boardTexture.ts';
import { makeRng, type Rng } from './prng.ts';
import { classifyRunout, BadRunoutError } from './runout.ts';

/**
 * What a turn or river card changed.
 *
 * The tests that matter are the consistency ones at the bottom: because these
 * tags are a delta over the board classifier, a runout that says
 * `flush_completing` and a board that does not say `flush_possible` would be
 * the two modules disagreeing about the same five cards. That is the failure
 * this file exists to make impossible.
 */

/** A seeded deal: the first `count` cards of a shuffled deck, in deal order. */
const deal = (rng: Rng, count: number): Card[] => rng.shuffle(DECK_CARDS).slice(0, count);

/** The card at `index` of a deal; dealing too few is a bug in the test. */
function nth(drawn: readonly Card[], index: number): Card {
    const card = drawn[index];
    if (card === undefined) throw new Error(`No card at ${index}`);
    return card;
}

const runout = (before: string, card: string, hole?: string): RunoutTag[] =>
    classifyRunout(cards(before), one(card), hole === undefined ? undefined : cards(hole));

describe('pairing', () => {
    it('calls a card matching the board a board pair', () => {
        expect(runout('Ah7c2d', 'Ac')).toContain('pairs_board');
    });

    it('calls a card matching the hero a hero pair', () => {
        expect(runout('Ah7c2d', 'Kc', 'KhQd')).toContain('pairs_hero');
    });

    it('can be both at once', () => {
        const tags = runout('Ah7c2d', 'Ac', 'AsKd');
        expect(tags).toContain('pairs_board');
        expect(tags).toContain('pairs_hero');
    });

    it('says nothing about the hero when no hole cards are supplied', () => {
        expect(runout('Ah7c2d', 'Kc')).not.toContain('pairs_hero');
    });
});

describe('overcards', () => {
    it('calls a card above everything showing an overcard', () => {
        expect(runout('9h7c2d', 'Ac')).toContain('overcard');
    });

    it('does not call a card below the top an overcard', () => {
        expect(runout('Ah7c2d', '9c')).not.toContain('overcard');
    });

    it('does not call a card equal to the top an overcard — that is a board pair', () => {
        const tags = runout('Ah7c2d', 'Ac');
        expect(tags).not.toContain('overcard');
        expect(tags).toContain('pairs_board');
    });
});

describe('flushes', () => {
    it('calls the third card of a suit flush-completing', () => {
        expect(runout('Ah7h2d', '9h')).toContain('flush_completing');
    });

    it('calls the second card of a suit flush-drawing while a card is still to come', () => {
        expect(runout('Ah7c2d', '9h')).toContain('flush_drawing');
    });

    it('does not call a river card flush-drawing, because nothing follows it', () => {
        expect(runout('Ah7c2d4s', '9h')).not.toContain('flush_drawing');
    });

    it('does not re-complete a flush that was already possible', () => {
        expect(runout('Ah7h2h', '9h')).not.toContain('flush_completing');
    });

    /**
     * The card nothing could name.
     *
     * A flush is "possible" from three of a suit, so the FOURTH completed
     * nothing (`flush_completing` wants it to have been impossible before) and
     * drew to nothing (`flush_drawing` wants it still impossible after). With
     * no tag left, `brick` claimed it — and the barrel rules that fire on a
     * brick fired into four hearts.
     */
    it('names a fourth card of a suit, and does not call it a brick', () => {
        const tags = runout('Ah7h2h', '9h');
        expect(tags).toContain('four_flush');
        expect(tags).not.toContain('brick');
    });

    it('names the fifth as well, which is the flush on the board itself', () => {
        expect(runout('Ah7h2h9h', '4h')).toContain('four_flush');
    });

    it('does not call three of a suit a four-flush', () => {
        expect(runout('Ah7h2d', '9h')).not.toContain('four_flush');
    });
});

describe('straights', () => {
    it('calls a card that brings in a straight for a playable holding straight-completing', () => {
        // 9-8-2 plus the seven: T-J now makes a straight, and that is a
        // holding that sees raised flops.
        expect(runout('9h8c2d', '7s')).toContain('straight_completing');
    });

    it('calls a card whose only fills contain a six or lower straight-completing-low', () => {
        // 9-5-2 plus the seven: only 8-6 arrives. Same window geometry as a
        // real scare card, but the completing holding is gap trash.
        const tags = runout('9h5c2d', '7s');
        expect(tags).toContain('straight_completing_low');
        expect(tags).not.toContain('straight_completing');
    });

    it('calls a card that gets closer without arriving straight-drawing', () => {
        // K-8-3 is maximally spread: no five-window holds two of them. The
        // queen puts K-Q together without putting a third rank in the window.
        expect(runout('Kh8c3d', 'Qs')).toContain('straight_drawing');
    });

    it('does not call a river card straight-drawing, because nothing follows it', () => {
        expect(runout('Kh8c3d2s', 'Qs')).not.toContain('straight_drawing');
    });

    it('does not re-complete a straight that was already possible', () => {
        expect(runout('9h8c7d', '2s')).not.toContain('straight_completing');
    });

    /** The straight mirror of the four-flush, and a brick for the same reason. */
    it('names a fourth board rank inside one window, and does not call it a brick', () => {
        // 9-8-7 is three in a window; the six makes it four, and every one-card
        // straight in the deck belongs to somebody.
        const tags = runout('9h8c7d', '6s');
        expect(tags).toContain('four_straight');
        expect(tags).not.toContain('brick');
    });

    it('reads the wheel, where the ace is the low card', () => {
        // A-9-2-4 holds A-2-4 in the bottom window; the three makes four to a
        // wheel. This board was the fixture for "a card that changes nothing".
        expect(runout('Ah9c2d4s', '3h')).toEqual(['four_straight']);
    });

    it('names the fifth as well, which is the straight on the board itself', () => {
        expect(runout('9h8c7d6s', 'Ts')).toContain('four_straight');
    });
});

describe('scare cards and blanks', () => {
    /**
     * The evidence for the qualifying-fill line, on invented boards. Each scare
     * card brings in a straight for a holding of two cards seven or higher; each
     * blank brings one in only for a holding with a six or lower in it. Raw
     * window geometry calls every one of them a scare card.
     */
    it.each([
        ['KdJc5h', 'Ts', 'A-Q and Q-9 arrive'],
        ['Qh8d3c', 'Jd', 'T-9 arrives'],
        ['Kc9s2d', 'Qh', 'J-T arrives'],
        ['Td6c2s', '8h', '9-7 arrives'],
    ])('reads %s + %s as a scare card (%s)', (before, card) => {
        expect(runout(before, card)).toContain('straight_completing');
    });

    it.each([
        ['Ac8d5c', '3h', 'only 4-2 connects'],
        ['Qc7s3h', '5d', 'only 6-4 connects'],
        ['Jd6c2h', '4s', 'only 5-3 connects'],
    ])('reads %s + %s as no scare card (%s)', (before, card) => {
        const tags = runout(before, card);
        expect(tags).not.toContain('straight_completing');
        expect(tags).toContain('straight_completing_low');
    });
});

describe('bricks', () => {
    it('calls a card that changes nothing a brick', () => {
        // K-8-3-2 spreads over four windows without filling one: no two of
        // them sit within two ranks, and the seven joins 8 without making a
        // third. Nothing of the suit either.
        expect(runout('Kh8c3d2s', '7h')).toEqual(['brick']);
    });

    it('never pairs brick with another tag', () => {
        const rng = makeRng(4242);
        for (let trial = 0; trial < 500; trial += 1) {
            const drawn = deal(rng, 5);
            const before = drawn.slice(0, 3 + (trial % 2));
            const card = nth(drawn, 4);
            const tags = classifyRunout(before, card);
            if (tags.includes('brick')) expect(tags).toEqual(['brick']);
            else expect(tags.length).toBeGreaterThan(0);
        }
    });
});

describe('agreeing with the board classifier', () => {
    /**
     * The consistency property. `flush_completing` claims a flush is possible
     * now and was not before; `boardTags` is the authority on whether a flush is
     * possible. If the two ever disagree, one of them is describing a board that
     * is not on the table.
     */
    it('only claims completion when the board classifier agrees a flush or straight arrived', () => {
        const rng = makeRng(31337);
        for (let trial = 0; trial < 1_500; trial += 1) {
            const drawn = deal(rng, 5);
            const before = drawn.slice(0, 3 + (trial % 2));
            const card = nth(drawn, 4);

            const tags = classifyRunout(before, card);
            const beforeTags = boardTags(before);
            const afterTags = boardTags([...before, card]);

            if (tags.includes('flush_completing')) {
                expect(beforeTags).not.toContain('flush_possible');
                expect(afterTags).toContain('flush_possible');
            }
            // `straight_completing` is qualifying-fill, not raw geometry, so a
            // board where only gap trash already connected can still complete:
            // the after-board must show the straight, but the before-board may
            // already have been `straight_possible` the trashy way (6-5-2,
            // where 4-3 connects, then the 7 brings in 9-8).
            if (tags.includes('straight_completing')) {
                expect(afterTags).toContain('straight_possible');
            }
            // The low tag IS the raw transition: a straight became possible
            // that was not before, just not for any seven-plus holding.
            if (tags.includes('straight_completing_low')) {
                expect(beforeTags).not.toContain('straight_possible');
                expect(afterTags).toContain('straight_possible');
            }
            if (tags.includes('pairs_board')) {
                expect(
                    afterTags.includes('paired') || afterTags.includes('trips'),
                ).toBe(true);
            }
        }
    });

    it('only ever emits tags the ontology declares', () => {
        const rng = makeRng(9);
        for (let trial = 0; trial < 300; trial += 1) {
            const drawn = deal(rng, 6);
            classifyRunout(drawn.slice(0, 3), nth(drawn, 3), drawn.slice(4, 6))
                .forEach((tag) => expect(RUNOUT_TAGS).toContain(tag));
        }
    });
});

describe('refusing to guess', () => {
    it.each([2, 5])('throws on a %i-card prior board', (count) => {
        expect(() => classifyRunout(cards('Ah9c2d4s3h').slice(0, count), one('Kc')))
            .toThrow(BadRunoutError);
    });
});
