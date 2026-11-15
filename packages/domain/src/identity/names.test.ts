import { describe, expect, it } from 'vitest';
import { namesMatch } from './names.ts';

describe('namesMatch', () => {
  it.each([
    ['the same name', 'Rahul Sharma', 'Rahul Sharma'],
    ['capitals, as a PAN gives them', 'RAHUL SHARMA', 'Rahul Sharma'],
    ['the surname first', 'SHARMA RAHUL', 'Rahul Sharma'],
    ['extra spaces and punctuation', '  Rahul   D\'Souza. ', 'rahul dsouza'],
    ['Devanagari, its vowel signs kept', 'राहुल शर्मा', 'शर्मा राहुल'],
    ['an accent written as a separate mark', `JOSE${String.fromCodePoint(0x301)} PINTO`, `Jos${String.fromCodePoint(0xe9)} Pinto`],
  ])('matches %s', (_, document, given) => {
    expect(namesMatch(document, given)).toBe(true);
  });

  it.each([
    ['a different surname', 'RAHUL VERMA', 'Rahul Sharma'],
    ['a middle name on the document only', 'RAHUL KUMAR SHARMA', 'Rahul Sharma'],
    ['a middle name given only', 'RAHUL SHARMA', 'Rahul Kumar Sharma'],
    ['a last word given only', 'RAHUL SHARMA', 'Rahul Sharma Zutshi'],
    ['an initial for a name', 'R SHARMA', 'Rahul Sharma'],
    ['a word given twice', 'RAHUL RAHUL', 'Rahul Sharma'],
    ['a document name with no letters', '1234', '1234'],
    ['an empty name', '', ''],
  ])('does not match %s', (_, document, given) => {
    expect(namesMatch(document, given)).toBe(false);
  });
});
