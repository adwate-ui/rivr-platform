import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { cardsOrThrow as board } from './cards/cards.ts';
import { BOARD_TAGS, type BoardTag } from './ontology/types.ts';
import { boardTags, BOARD_TAG_RULES, FLOP_UNREACHABLE_TAGS } from './boardTexture.ts';
import { boardFacts, BadBoardError } from './boardFacts.ts';
import { canonicalFlops, show } from './boardEnumeration.ts';

/**
 * The board texture classifier.
 *
 * Two kinds of test, and both are needed. The digest over all 1,755
 * suit-isomorphic flops is a tripwire: it catches ANY change to tagging,
 * including the ones nobody predicted. The longhand cases below it are the
 * documentation: they say what the classifier MEANS, which a hash cannot. A
 * hash alone leaves a failure with no explanation; cases alone leave the
 * 22,000 boards nobody wrote a case for unguarded.
 */

const tagsOf = (notation: string): BoardTag[] => boardTags(board(notation));

/* ── the exhaustive sweep ────────────────────────────────────────────────── */

describe('across every distinct flop', () => {
    const flops = canonicalFlops();

    /**
     * This assertion IS the proof that the isomorphism collapse is correct.
     * A collapse that merged too much would land under 1,755; one that merged
     * too little would land over it. Only the right one hits the number.
     */
    it('collapses 22,100 flops to exactly 1,755 distinct boards', () => {
        expect(flops).toHaveLength(1755);
    });

    it('gives every board exactly one suit tag, one connectedness tag and one height tag', () => {
        const groups: BoardTag[][] = [
            ['monotone', 'two_tone', 'rainbow'],
            ['connected', 'gapped', 'disconnected'],
            ['low', 'middling', 'high'],
        ];

        for (const { flop } of flops) {
            const tags = new Set(boardTags(flop));
            for (const group of groups) {
                const hits = group.filter((tag) => tags.has(tag));
                expect(hits, `${show(flop)} carries ${hits.length} of ${group.join('/')}`).toHaveLength(1);
            }
        }
    });

    it('never claims a completed straight or flush on three cards', () => {
        for (const { flop } of flops) {
            const tags = boardTags(flop);
            FLOP_UNREACHABLE_TAGS.forEach((tag) => {
                expect(tags, `${show(flop)}`).not.toContain(tag);
            });
        }
    });

    /**
     * Reachability, stated explicitly rather than left implicit.
     *
     * Every tag a flop CAN carry must fire on at least one of the 1,755, or the
     * predicate is dead code the generator will reject boards against forever.
     * Pinning the complement documents which tags are turn-and-river-only,
     * which is otherwise a question someone has to re-derive.
     */
    it('fires every tag a three-card board can carry, and only those', () => {
        const seen = new Set<BoardTag>();
        flops.forEach(({ flop }) => boardTags(flop).forEach((tag) => seen.add(tag)));

        const reachable = BOARD_TAGS.filter((tag) => !FLOP_UNREACHABLE_TAGS.includes(tag));
        expect([...seen].sort()).toEqual([...reachable].sort());
    });

    /**
     * The tripwire. `tagHistogram` is what makes a failure diagnosable — the
     * hash says something moved, the histogram says which tag moved and by how
     * much. Updating this snapshot is a deliberate act: a diff here means every
     * drill keyed on the changed tag now asks a different question.
     */
    it('tags all 1,755 identically to the committed digest', () => {
        const lines = flops.map(({ key, flop }) => `${key}|${boardTags(flop).join(',')}`);
        const hash = createHash('sha256').update(lines.join('\n')).digest('hex');

        const tagHistogram = new Map<BoardTag, number>(BOARD_TAGS.map((tag) => [tag, 0]));
        flops.forEach(({ flop }) => boardTags(flop).forEach((tag) => {
            tagHistogram.set(tag, (tagHistogram.get(tag) ?? 0) + 1);
        }));

        expect({ hash, tagHistogram: Object.fromEntries(tagHistogram) }).toMatchSnapshot();
    });
});

/* ── what the tags mean ──────────────────────────────────────────────────── */

describe('pairing', () => {
    it('calls a rank appearing twice paired, and does not call it trips', () => {
        expect(tagsOf('AhAd7c')).toContain('paired');
        expect(tagsOf('AhAd7c')).not.toContain('trips');
    });

    it('calls a rank appearing three times trips, and not paired', () => {
        expect(tagsOf('AhAdAc')).toContain('trips');
        expect(tagsOf('AhAdAc')).not.toContain('paired');
    });

    it('carries both when a five-card board has a set and a separate pair', () => {
        const tags = tagsOf('AhAdAc7c7d');
        expect(tags).toContain('trips');
        expect(tags).toContain('paired');
    });

    it('leaves an unpaired board with neither', () => {
        expect(tagsOf('AhKd7c')).not.toContain('paired');
        expect(tagsOf('AhKd7c')).not.toContain('trips');
    });
});

describe('suits', () => {
    it.each([
        ['monotone', 'AhKh7h'],
        ['two_tone', 'AhKh7c'],
        ['rainbow', 'AhKd7c'],
    ] as const)('calls %s what it is', (tag, notation) => {
        expect(tagsOf(notation)).toContain(tag);
    });

    it('counts a four-card board with three suits as rainbow, not as nothing', () => {
        expect(tagsOf('AhKh7c4d')).toContain('rainbow');
    });

    it('flags a flush as possible from three of a suit, and complete only at five', () => {
        expect(tagsOf('AhKh7h')).toContain('flush_possible');
        expect(tagsOf('AhKh7h4h')).toContain('flush_possible');
        expect(tagsOf('AhKh7h4h')).not.toContain('flush_complete');
        expect(tagsOf('AhKh7h4h2h')).toContain('flush_complete');
    });

    it('does not call two of a suit a possible flush', () => {
        expect(tagsOf('AhKh7c')).not.toContain('flush_possible');
    });
});

describe('connectedness', () => {
    it('calls adjacent ranks connected', () => {
        expect(tagsOf('9h8d2c')).toContain('connected');
    });

    it('treats the ace as low so that A-2 is connected', () => {
        expect(tagsOf('Ah2d7c')).toContain('connected');
    });

    it('calls a single gap gapped', () => {
        expect(tagsOf('9h7d2c')).toContain('gapped');
    });

    it('calls everything else disconnected', () => {
        expect(tagsOf('Ah9d3c')).toContain('disconnected');
    });

    it('counts a paired board as disconnected on the rank axis', () => {
        // Two aces are not "adjacent"; connectedness is about distinct ranks.
        expect(tagsOf('AhAd7c')).toContain('disconnected');
    });

    it('calls a trips board disconnected rather than leaving it untagged', () => {
        expect(tagsOf('AhAdAc')).toContain('disconnected');
    });
});

describe('height', () => {
    it.each([
        ['low', '8h5d2c'],
        ['middling', 'Jh5d2c'],
        ['high', 'Qh5d2c'],
    ] as const)('calls a board topped for %s', (tag, notation) => {
        expect(tagsOf(notation)).toContain(tag);
    });

    it('puts the boundaries where the docblock says', () => {
        expect(tagsOf('8h5d2c')).toContain('low');
        expect(tagsOf('9h5d2c')).toContain('middling');
        expect(tagsOf('Jh5d2c')).toContain('middling');
        expect(tagsOf('Qh5d2c')).toContain('high');
    });

    it('marks an ace board ace_high as well as high', () => {
        const tags = tagsOf('Ah5d2c');
        expect(tags).toContain('ace_high');
        expect(tags).toContain('high');
    });

    it('does not call a king-high board ace_high', () => {
        expect(tagsOf('Kh5d2c')).not.toContain('ace_high');
    });

    it('calls two broadway cards broadway_heavy, and one not', () => {
        expect(tagsOf('AhKd7c')).toContain('broadway_heavy');
        expect(tagsOf('AhTd7c')).toContain('broadway_heavy');
        expect(tagsOf('Ah9d7c')).not.toContain('broadway_heavy');
    });
});

describe('straights', () => {
    it('calls three cards inside a five-window a possible straight', () => {
        expect(tagsOf('9h8d7c')).toContain('straight_possible');
        expect(tagsOf('9h8d5c')).toContain('straight_possible');
    });

    it('sees the wheel, so A-2-3 is a possible straight', () => {
        expect(tagsOf('Ah2d3c')).toContain('straight_possible');
    });

    it('does not call three scattered ranks a possible straight', () => {
        expect(tagsOf('Ah9d3c')).not.toContain('straight_possible');
    });

    it('flags a five-card run as a completed straight', () => {
        expect(tagsOf('9h8d7c6s5h')).toContain('straight_complete');
    });

    it('flags a board wheel as complete, topped by the five', () => {
        expect(tagsOf('Ah2d3c4s5h')).toContain('straight_complete');
        expect(boardFacts(board('Ah2d3c4s5h')).straightOnBoardTop).toBe(5);
    });

    it('does not call four to a straight complete', () => {
        expect(tagsOf('9h8d7c6s2h')).not.toContain('straight_complete');
    });

    it('takes the highest run when a board holds more than one', () => {
        expect(boardFacts(board('9h8d7c6s5h')).straightOnBoardTop).toBe(9);
    });
});

/* ── facts and guards ────────────────────────────────────────────────────── */

describe('boardFacts', () => {
    it('reports distinct ranks descending, and counts by rank', () => {
        const facts = boardFacts(board('7cAhAd'));
        expect(facts.ranks).toEqual([14, 7]);
        expect(facts.rankCounts[14]).toBe(2);
        expect(facts.highest).toBe(14);
    });

    it('reports suit spread', () => {
        const facts = boardFacts(board('AhKh7c'));
        expect(facts.suitCounts.h).toBe(2);
        expect(facts.distinctSuits).toBe(2);
        expect(facts.maxSuitCount).toBe(2);
    });

    it('has no closest gap when every card is the same rank', () => {
        expect(boardFacts(board('AhAdAc')).closestGap).toBe(Infinity);
    });

    it('is independent of the order the cards arrive in', () => {
        expect(boardFacts(board('AhKd7c'))).toEqual(boardFacts(board('7cKdAh')));
    });

    it.each([2, 6])('refuses a %i-card board rather than guessing', (count) => {
        const cards = board('AhKd7c4s2h9d').slice(0, count);
        expect(() => boardFacts(cards)).toThrow(BadBoardError);
    });
});

describe('the predicate table', () => {
    it('has a predicate for every tag in the ontology, and no others', () => {
        expect(Object.keys(BOARD_TAG_RULES).sort()).toEqual([...BOARD_TAGS].sort());
    });

    it('returns tags in the ontology-declared order, not alphabetically', () => {
        const tags = tagsOf('AhKh7h');
        const positions = tags.map((tag) => BOARD_TAGS.indexOf(tag));
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });
});

/**
 * The static-to-dynamic scale.
 *
 * These four tags are the terms rules reason in, and the scale reads the height
 * of the top card first: big-card boards tend to be static, small-card boards
 * dynamic. Suits and connectedness modify that; they do not replace it. If the
 * classifier puts a big ragged flop anywhere but `static`, every principle
 * scoped by `static` claims the wrong spots, and no amount of downstream
 * accuracy makes that right. The boards below are invented to pin each case.
 */
describe('the texture scale', () => {
    it('calls a big, ragged, rainbow flop static', () => {
        expect(tagsOf('Qd8c2s')).toContain('static');
        expect(tagsOf('Qd8c2s')).not.toContain('dynamic');
    });

    it('calls a small flop dynamic even when it is rainbow and ragged', () => {
        // Nothing is drawing-heavy here in the usual sense — it is dynamic
        // because the cards are small, so overcards keep arriving that change
        // who is winning.
        expect(tagsOf('8s6d2c')).toContain('dynamic');
        expect(tagsOf('8s6d2c')).not.toContain('static');
    });

    it('calls a big flop with a flush draw semi-static, not dynamic', () => {
        // Big cards keep it out of `dynamic`; the flush draw keeps it out of
        // `static`.
        expect(tagsOf('AsJs4d')).toContain('semi_static');
        expect(tagsOf('AsJs4d')).not.toContain('dynamic');
        expect(tagsOf('AsJs4d')).not.toContain('static');
    });

    it('calls a connected middling flop dynamic', () => {
        expect(tagsOf('Jc9d8h')).toContain('dynamic');
    });

    it('puts a high monotone flop in the middle ground, not with the dynamic ones', () => {
        // Three of a suit is the flush-draw middle ground when the cards are
        // big. A LOW monotone flop is dynamic anyway, because its ranks are.
        expect(tagsOf('QhTh5h')).toContain('semi_static');
        expect(tagsOf('QhTh5h')).not.toContain('dynamic');
        expect(tagsOf('7s5s3s')).toContain('dynamic');
    });

    it('gives every flop exactly one of the three', () => {
        // The three are a partition, not three independent adjectives. If a
        // flop could be both static and dynamic, a principle scoped to one of
        // them would claim spots the source excludes from it — and a flop that
        // is none of them would be claimed by no texture principle at all.
        const exclusive = ['static', 'semi_static', 'dynamic'] as const;
        canonicalFlops().forEach(({ flop }) => {
            const tags = boardTags(flop);
            expect(exclusive.filter((tag) => tags.includes(tag)))
                .toHaveLength(1);
        });
    });

    it('tags two wheel cards, a common cue for rules about continuing to bet', () => {
        expect(tagsOf('9d5c3h')).toContain('two_wheel_cards');
        expect(tagsOf('Kc4d2s')).toContain('two_wheel_cards');
        expect(tagsOf('Qd8c2s')).not.toContain('two_wheel_cards');
    });
});
