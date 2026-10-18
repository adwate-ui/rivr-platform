/**
 * The copy rules from .claude/rules/copy.md and the design prompt, checked on every message.
 * The banned words are the union of both lists (additions, "Resolved conflicts").
 */
import { describe, expect, it } from 'vitest';
import { en } from './catalogue/en/index.ts';

const BANNED_WORDS = [
  'unlock', 'elevate', 'seamless', 'effortless', 'experience', 'journey', 'discover', 'explore',
  'dive in', 'level up', 'exclusive', 'premium', 'curated', 'welcome back', "let's", 'let’s',
  'oops', 'awesome', 'amazing', 'powered by', 'smart',
];

/** Every message in a catalogue as [key, text] pairs. */
function messages(node: object, prefix = ''): [string, string][] {
  return Object.entries(node).flatMap(([key, value]): [string, string][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') return [[path, value]];
    return typeof value === 'object' && value !== null ? messages(value, path) : [];
  });
}

const english = messages(en);

describe('copy rules', () => {
  it.each(BANNED_WORDS)('never uses the banned word "%s"', (word) => {
    const pattern = new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'iu');
    expect(english.filter(([, text]) => pattern.test(text)).map(([key]) => key)).toEqual([]);
  });

  it('never says "AI"', () => {
    expect(english.filter(([, text]) => /\bAI\b/.test(text)).map(([key]) => key)).toEqual([]);
  });

  it('has no exclamation marks, emoji or em dashes', () => {
    const offending = english.filter(([, text]) => /[!—]|\p{Extended_Pictographic}/u.test(text));
    expect(offending.map(([key]) => key)).toEqual([]);
  });

  it('has no empty messages', () => {
    expect(english.filter(([, text]) => text.trim() === '').map(([key]) => key)).toEqual([]);
  });
});
