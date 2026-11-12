import { SITE_BLOCK_KINDS, siteBlockSchema } from '@rivr/contracts';
import type { EditorBlock } from '@rivr/db/siteEditor';
import { t } from '@rivr/i18n';
import type { Content } from './blockFields.ts';

/** A kind in words: "Hero", "Cards"; "Block" for a kind the website does not know. */
export function kindName(kind: string): string {
  const known = SITE_BLOCK_KINDS.find((each) => each === kind);
  return known === undefined ? t('console.website.kinds.other') : t(`console.website.kinds.${known}`);
}

/**
 * What a new section of each kind starts with: its words empty, to fill in before saving (#906). A kind that needs a
 * picture, a map link, a table's grid or a link into the app is not here, as the editor changes words only; the live
 * kinds, whose rows the website reads for itself, start with their heading.
 */
const NEW_CONTENT: Readonly<Record<string, Content>> = {
  hero: { eyebrow: '', heading: '', text: '' },
  statement: { lines: [''] },
  text: { heading: '', body: '' },
  rules: { heading: '', rules: [''] },
  faq: { heading: '', questions: [{ question: '', answer: '' }] },
  story: { eyebrow: '', heading: '', paragraphs: [''] },
  cards: { eyebrow: '', heading: '', intro: '', cards: [{ title: '', text: '' }, { title: '', text: '' }] },
  timeline: { eyebrow: '', heading: '', intro: '', items: [{ when: '', title: '', text: '' }] },
  marquee: { phrases: ['', ''] },
  careers: { heading: '', roles: [{ title: '', body: '' }], apply: '' },
  promotions: { eyebrow: '', heading: '' },
  games: { heading: '' },
  calendar: { heading: '' },
  league: { heading: '' },
  rewards: { heading: '' },
  outstation: { eyebrow: '', heading: '' },
  jackpot: { eyebrow: '', heading: '' },
  social_wall: { heading: '' },
};

/** The kinds a section can be added as, or changed into, in the editor's order. */
export const ADDABLE_KINDS: readonly string[] = Object.keys(NEW_CONTENT);

/** How many items a list may hold, as siteBlockSchema allows, and a new item's empty words. */
export interface ListRule {
  readonly min: number;
  readonly max: number;
  /** None where an item needs a picture or a link the editor cannot set: such a list only loses items. */
  readonly item?: Content;
}

// By kind and list, the item numbers left out (#906); sections.test.ts holds each to siteBlockSchema.
export const LIST_RULES: Readonly<Record<string, ListRule>> = {
  'statement.lines': { min: 1, max: 3, item: '' },
  'gallery.items': { min: 2, max: 8 },
  'feature.points': { min: 0, max: 4, item: '' },
  'rules.rules': { min: 1, max: 40, item: '' },
  'faq.questions': { min: 1, max: 40, item: { question: '', answer: '' } },
  'careers.roles': { min: 0, max: 20, item: { title: '', body: '' } },
  'links.links': { min: 1, max: 6 },
  'story.paragraphs': { min: 1, max: 3, item: '' },
  'story.figures': { min: 0, max: 4, item: { value: '', label: '' } },
  'cards.cards': { min: 2, max: 12, item: { title: '', text: '' } },
  'cards.cards.points': { min: 0, max: 6, item: '' },
  'marquee.phrases': { min: 2, max: 12, item: '' },
  'timeline.items': { min: 1, max: 10, item: { when: '', title: '', text: '' } },
};

/** The rule for the list at a place in a kind's content: `cards` and `['cards', 1, 'points']` is `cards.cards.points`. Null for one with none. */
export function listRule(kind: string, path: readonly (string | number)[]): ListRule | null {
  return LIST_RULES[[kind, ...path.filter((step): step is string => typeof step === 'string')].join('.')] ?? null;
}

/** The kinds a section may be added as, or changed into: a page holds one hero at most, as the website shows one. */
export function kindsFor(sections: readonly EditorBlock[], current: EditorBlock | null): readonly string[] {
  const hasOtherHero = sections.some((section) => section.kind === 'hero' && section !== current);
  return hasOtherHero ? ADDABLE_KINDS.filter((kind) => kind !== 'hero') : ADDABLE_KINDS;
}

/** A new section of a kind, with its own copy of the empty words. */
export function newSection(kind: string): EditorBlock {
  return { kind, content: structuredClone(NEW_CONTENT[kind] ?? {}) };
}

/** What a kind's content takes, field by field, as the website reads it; none for a kind it does not know. */
function fieldsTakenBy(kind: string): Readonly<Record<string, { safeParse: (value: unknown) => { success: boolean } }>> {
  return siteBlockSchema.options.find((option) => option.shape.kind.value === kind)?.shape.content.shape ?? {};
}

const isRecord = (value: Content): value is { readonly [key: string]: Content | undefined } =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A section changed into another kind (#906): the new kind's empty words, with each of them the old section had under the
 * same name and the new kind takes as it is. One it would read differently (too long, or a list of other things) starts
 * empty, and a picture, a link or a button, which the editor cannot set, is left behind.
 */
export function retyped(section: EditorBlock, kind: string): EditorBlock {
  const fresh = newSection(kind).content;
  const taken = fieldsTakenBy(kind);
  const old = isRecord(section.content) ? section.content : {};
  const words = isRecord(fresh) ? fresh : {};
  const kept = Object.keys(words).flatMap((key) => {
    const value = old[key];
    return value !== undefined && taken[key]?.safeParse(value).success === true ? [[key, value] as const] : [];
  });
  return { kind, content: { ...words, ...Object.fromEntries(kept) } };
}

/** The list with the item at `index` moved one place (`by` -1 up, 1 down); as it was at either end. */
export function moved<T>(list: readonly T[], index: number, by: -1 | 1): readonly T[] {
  const to = index + by;
  const item = list[index];
  const other = list[to];
  if (item === undefined || other === undefined) return list;
  return list.map((each, place) => (place === index ? other : place === to ? item : each));
}
