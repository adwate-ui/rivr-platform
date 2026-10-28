import { builtInSource } from '@rivr/drills/sources';
import { describe, expect, it } from 'vitest';
import { openBook, type Book } from './drill.ts';
import { dealQuiz, lessonsOf, markQuiz, QUIZ_LENGTH, quizHandSpots } from './lessons.ts';

async function readHands(): Promise<Book> {
  const book = openBook(await builtInSource('src_read_hands')?.load());
  if (book === null) throw new Error('the book does not open');
  return book;
}

describe('lessons', () => {
  it('makes a lesson of each unit with principles, in the book\u2019s order, quizzing only labels and counts', async () => {
    const lessons = lessonsOf(await readHands());
    expect(lessons.length).toBeGreaterThan(5);
    const flop = lessons.find((lesson) => lesson.unitId === 'unit_rh_flop');
    expect(flop?.cards.length).toBeGreaterThan(flop?.quizzed.length ?? 0);
    expect(flop?.quizzed.length).toBe(3);
    expect(lessons.find((lesson) => lesson.unitId === 'unit_rh_player_types')?.quizzed).toEqual([]);
  });

  it('deals a label quiz and marks the right label right and another wrong', async () => {
    const book = await readHands();
    const flop = lessonsOf(book).find((lesson) => lesson.unitId === 'unit_rh_flop');
    if (flop === undefined) throw new Error('no flop lesson');
    const spots = dealQuiz(book, flop, 'test');
    expect(spots).toHaveLength(QUIZ_LENGTH);
    const [first] = spots;
    if (first === undefined || first.resolution.kind !== 'classify') throw new Error('expected a label question');
    const right = first.resolution.outcome.label;
    expect(markQuiz(first, { kind: 'classify', label: right })).toMatchObject({ correct: true });
    const wrong = right === 'strong_fit' ? 'weak_fit' : 'strong_fit';
    expect(markQuiz(first, { kind: 'classify', label: wrong }).correct).toBe(false);
  });

  it('deals a count quiz and marks the engine\u2019s own count right', async () => {
    const book = await readHands();
    const combos = lessonsOf(book).find((lesson) => lesson.unitId === 'unit_rh_combos');
    if (combos === undefined) throw new Error('no combinations lesson');
    const [first] = dealQuiz(book, combos, 'test');
    if (first === undefined || first.resolution.kind !== 'count') throw new Error('expected a count question');
    expect(markQuiz(first, { kind: 'count', value: first.resolution.outcome.value })).toMatchObject({ correct: true, answer: expect.stringContaining(' of ') });
  });

  it('asks nothing of a lesson with no label or count principle', async () => {
    const book = await readHands();
    const types = lessonsOf(book).find((lesson) => lesson.unitId === 'unit_rh_player_types');
    if (types === undefined) throw new Error('no player types lesson');
    expect(dealQuiz(book, types, 'test')).toEqual([]);
  });

  it('asks the book\u2019s own quiz hands first, each where its principle answers as the author did', async () => {
    const book = await readHands();
    const lessons = lessonsOf(book);
    const hands = lessons.flatMap((lesson) => quizHandSpots(book, lesson));
    expect(hands.length).toBeGreaterThan(0);
    for (const spot of hands) expect(lessons.some((lesson) => lesson.quizzed.includes(spot.principle))).toBe(true);
    const lesson = lessons.find((each) => quizHandSpots(book, each).length > 0);
    if (lesson === undefined) throw new Error('no lesson with a quiz hand');
    expect(dealQuiz(book, lesson, 'test')[0]?.scenario).toEqual(quizHandSpots(book, lesson)[0]?.scenario);
  });
});
