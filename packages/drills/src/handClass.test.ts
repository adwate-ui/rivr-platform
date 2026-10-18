import { describe, it, expect } from 'vitest';
import { cardsOrThrow as cards } from './cards/cards.ts';
import { HAND_CLASSES, DRAW_CLASSES, type DrawClass, type HandClass } from './ontology/types.ts';
import { classifyMadeHand, BadHoleCardsError, GOOD_KICKER_MIN } from './handClass.ts';
import { classifyDraws } from './draws.ts';

/**
 * What the hero has.
 *
 * The cases that earn their place here are the ones where the seven-card
 * evaluation and the hero's actual holding come apart: counterfeited two pair,
 * a board that plays, a pair that belongs to the board rather than to anybody.
 * Those are the spots a drill would otherwise ask a nonsense question about.
 */

const classOf = (hole: string, board: string): HandClass =>
    classifyMadeHand(cards(hole), cards(board)).handClass;

const drawsOf = (hole: string, board: string): DrawClass[] =>
    classifyDraws(cards(hole), cards(board));

const MADE_HANDS: readonly (readonly [HandClass, string, string])[] = [
    ['full_house_plus', 'AhAd', 'AcKhKd'],
    ['full_house_plus', 'AhAd', 'AcAsKd'],
    ['flush', 'AhKh', '7h4h2h'],
    ['straight', 'Th9h', '8d7c6s'],
    ['set', 'AhAd', 'Ac7h2s'],
    ['two_pair', 'AhKd', 'AcKh2s'],
    ['overpair', 'AhAd', 'Kc7h2s'],
    ['top_pair_good_kicker', 'AhKd', 'Ac7h2s'],
    ['top_pair_weak_kicker', 'Ah4d', 'Ac7h2s'],
    ['second_pair', '7h6d', 'Ac7d2s'],
    ['weak_pair', '2h3d', 'Ac7d2s'],
    ['underpair', '7h7d', 'AcKh2s'],
    ['no_pair', 'Qh9d', 'Ac7h2s'],
];

describe('made hands', () => {
    it.each(MADE_HANDS)('calls %s what it is', (expected, hole, board) => {
        expect(classOf(hole, board)).toBe(expected);
    });

    it('does not call trips on the board a set — the hero must hold one of them', () => {
        // Used to be 'set': every rule written for sets was dealt this and told
        // the reader to call a big turn raise holding ace-high.
        expect(classOf('AhKd', 'QcQsQh7d')).toBe('ace_high');
        expect(classOf('7h2d', '9c9d9sAh')).toBe('no_pair');
        // A pocket pair that fills the board's trips is a full house, not this.
        expect(classOf('7h7d', '9c9d9sAh')).toBe('full_house_plus');
    });

    it('makes a set from a pocket pair and trips from one hole card alike', () => {
        expect(classOf('AhAd', 'Ac7h2s')).toBe('set');
        expect(classOf('Ah2d', 'AcAs7h')).toBe('set');
        expect(classOf('KhQd', 'KcKs7h')).toBe('set');
    });

    it('only classes hands the ontology knows about', () => {
        expect(HAND_CLASSES).toContain(classOf('AhKd', 'Ac7h2s'));
    });
});

describe('the kicker line', () => {
    it('is drawn at a ten, as documented', () => {
        expect(GOOD_KICKER_MIN).toBe(10);
        expect(classOf('AhTd', 'Ac7h2s')).toBe('top_pair_good_kicker');
        expect(classOf('Ah9d', 'Ac7h2s')).toBe('top_pair_weak_kicker');
    });

    it('reads the kicker off whichever hole card is not the paired one', () => {
        // A-K on a king-high board: the LOWER hole card makes the pair and the
        // ace is the kicker, which is the reverse of the usual arrangement.
        expect(classOf('AhKd', 'Kc7h2s')).toBe('top_pair_good_kicker');
        expect(classOf('Ah2d', 'Ac7h2s')).toBe('two_pair');
    });
});

describe('hands the board is really holding', () => {
    it('gives the hero no pair when the pair belongs to the board', () => {
        // Board pairs sevens; 5-2 contributes nothing.
        expect(classOf('5h2d', 'Ac7h7d')).toBe('no_pair');
    });

    it('gives the hero no two pair when both pairs belong to the board', () => {
        expect(classOf('5h2d', 'Ac7h7dAs')).toBe('no_pair');
    });

    it('counterfeits a hero two pair when the board pairs higher', () => {
        // 3-2 made two pair on 3-2-9; the river pairs aces and kings and the
        // hole cards stop mattering entirely.
        expect(classOf('3h2d', 'AcAdKhKs9c')).toBe('no_pair');
    });

    it('calls an unmade hand with an ace in it ace-high, and one without it no pair', () => {
        // The best unmade hand gets its own class, so a rule written for it
        // is never dealt king-high.
        expect(classOf('AdQd', '8hTc6c')).toBe('ace_high');
        expect(classOf('KcJs', '5dAd2c')).toBe('no_pair');
        // Still ace-high when the pair, trips or two pair belong to the board alone.
        expect(classOf('Ah8d', 'Jh7h7d')).toBe('ace_high');
        expect(classOf('AhKd', 'QcQsQh7d')).toBe('ace_high');
        expect(classOf('Ac9d', '5d5s3h3c')).toBe('ace_high');
        // An ace on the board with the hero's ace is a pair, not ace-high.
        expect(classOf('Ad4h', 'As9c2d')).toBe('top_pair_weak_kicker');
    });

    it('says no pair when the board plays the whole hand', () => {
        expect(classOf('2c3d', 'AhKhQhJhTh')).toBe('no_pair');
    });

    it('still credits the hero when their card improves on a paired board', () => {
        expect(classOf('Ah5d', 'Ac7h7d')).toBe('two_pair');
    });

    it('separates an overpair from an underpair by the top board card', () => {
        expect(classOf('QhQd', 'Jc7h2s')).toBe('overpair');
        expect(classOf('QhQd', 'Kc7h2s')).toBe('underpair');
        expect(classOf('QhQd', 'Ac7h2s')).toBe('underpair');
    });
});

describe('draws', () => {
    it('finds a flush draw from four of a suit the hero is in', () => {
        expect(drawsOf('AhKh', '7h4h2c')).toContain('flush_draw');
    });

    it('does not give the hero a flush draw the board is holding alone', () => {
        expect(drawsOf('AcKd', '7h4h2h')).not.toContain('flush_draw');
    });

    it('finds a backdoor flush on the flop, but not on the turn', () => {
        expect(drawsOf('AhKh', '7h4c2d')).toContain('backdoor_flush');
        expect(drawsOf('AhKh', '7h4c2d9s')).not.toContain('backdoor_flush');
    });

    it('separates open-ended from a gutshot by how many ranks complete it', () => {
        // T-9-8-7 completes with a jack or a six: two ranks, so open-ended.
        expect(drawsOf('Th9d', '8c7s2h')).toContain('open_ended');
        expect(drawsOf('Th9d', '8c7s2h')).not.toContain('gutshot');

        // K-Q-J-9 completes only with a ten: one rank, so a gutshot.
        expect(drawsOf('KhQd', 'Jc9s2h')).toContain('gutshot');
        expect(drawsOf('KhQd', 'Jc9s2h')).not.toContain('open_ended');
    });

    it('sees the wheel draw, so A-2 on 3-4-x is open-ended', () => {
        expect(drawsOf('Ah2d', '3c4s9h')).toContain('gutshot');
    });

    it('names a flush draw plus a straight draw a combo draw, keeping both parts', () => {
        // Four hearts and K-Q-J-9 needing a ten.
        const draws = drawsOf('KhQh', 'Jh9c2h');
        expect(draws).toContain('flush_draw');
        expect(draws).toContain('gutshot');
        expect(draws).toContain('combo_draw');
    });

    it('finds a backdoor straight on the flop only', () => {
        // K-Q-J needs both an ace and a ten, so it is two cards away, not one.
        expect(drawsOf('KhQd', 'Jc5s2h')).toContain('backdoor_straight');
        expect(drawsOf('KhQd', 'Jc5s2h')).not.toContain('gutshot');

        expect(drawsOf('9h8d', 'Ac7h2s')).toContain('backdoor_straight');
        expect(drawsOf('9h8d', 'Ac7h2s4c')).not.toContain('backdoor_straight');
    });

    it('reports none when there is nothing to draw to', () => {
        expect(drawsOf('Kh2d', 'Ac7s9c')).toEqual(['none']);
    });

    it('reports none on the river, because there is no card to come', () => {
        expect(drawsOf('AhKh', '7h4h2c9s')).toContain('flush_draw');
        expect(drawsOf('AhKh', '7h4h2c9s3d')).toEqual(['none']);
    });

    it('only reports draws the ontology knows about', () => {
        drawsOf('KhQh', 'Jh9c2h').forEach((draw) => expect(DRAW_CLASSES).toContain(draw));
    });

    it('does not count a straight draw the board holds without the hero', () => {
        // 9-8-7 on board; the hero's A-K is not part of any run it completes.
        expect(drawsOf('AhKd', '9c8s7h')).toEqual(['none']);
    });
});

describe('refusing to guess', () => {
    it.each([1, 3])('throws on %i hole cards', (count) => {
        expect(() => classifyMadeHand(cards('AhKdQc').slice(0, count), cards('7h4c2d')))
            .toThrow(BadHoleCardsError);
    });
});
