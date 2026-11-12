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
 * A section changed into another kind (#906): the new kind's empty words, with each field of the same name the old section
 * had and the new kind takes as it is. One it would read differently (too long, or a list of other things) starts empty.
 */
export function retyped(section: EditorBlock, kind: string): EditorBlock {
  const fresh = newSection(kind);
  const taken = fieldsTakenBy(kind);
  const old = isRecord(section.content) ? section.content : {};
  const kept = Object.entries(old).filter(([key, value]) => value !== undefined && taken[key]?.safeParse(value).success === true);
  return { kind, content: { ...(isRecord(fresh.content) ? fresh.content : {}), ...Object.fromEntries(kept) } };
}

/** The list with the item at `index` moved one place (`by` -1 up, 1 down); as it was at either end. */
export function moved<T>(list: readonly T[], index: number, by: -1 | 1): readonly T[] {
  const to = index + by;
  const item = list[index];
  const other = list[to];
  if (item === undefined || other === undefined) return list;
  return list.map((each, place) => (place === index ? other : place === to ? item : each));
}
