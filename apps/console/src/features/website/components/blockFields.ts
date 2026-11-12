/** The words in a block the editor offers to change; links, pictures and addresses stay as they are. */
export const TEXT_KEYS = [
  'eyebrow', 'heading', 'intro', 'title', 'question', 'value', 'label', 'when', 'text', 'body', 'answer', 'quote', 'note', 'alt', 'apply', 'address', 'hours',
  'phone', 'email', 'lines', 'points', 'rules', 'phrases', 'paragraphs',
] as const;
export type TextKey = (typeof TEXT_KEYS)[number];

/** A block's content as the database keeps it: JSON. */
export type Content = string | number | boolean | null | Content[] | { readonly [key: string]: Content | undefined };

const isTextKey = (key: string): key is TextKey => TEXT_KEYS.some((known) => known === key);

/**
 * Each kind's keys in the order its `<Kind>Block` draws them, and each list item's under `<kind>.<list>` (F-040). A kind
 * with one word needs no order, and a key not listed goes after those that are, so none is ever dropped.
 */
const PAGE_ORDER: Readonly<Record<string, readonly string[]>> = {
  hero: ['eyebrow', 'heading', 'text', 'action', 'note'],
  statement: ['eyebrow', 'lines', 'text', 'action', 'note'],
  gallery: ['eyebrow', 'heading', 'intro', 'items', 'note'],
  'gallery.items': ['alt', 'title', 'text'],
  feature: ['eyebrow', 'heading', 'text', 'points', 'action', 'alt'],
  story: ['eyebrow', 'heading', 'paragraphs', 'action', 'alt', 'figures'],
  // Drawn reversed, the figure over its label.
  'story.figures': ['value', 'label'],
  cards: ['eyebrow', 'heading', 'intro', 'cards', 'quote', 'action'],
  'cards.cards': ['label', 'title', 'text', 'points', 'link'],
  careers: ['heading', 'roles', 'apply'],
  'careers.roles': ['title', 'body'],
  timeline: ['eyebrow', 'heading', 'intro', 'items'],
  'timeline.items': ['when', 'title', 'text', 'link'],
  faq: ['heading', 'questions'],
  'faq.questions': ['question', 'answer'],
  text: ['heading', 'body'],
  rules: ['heading', 'rules'],
  map: ['heading', 'address', 'hours', 'phone', 'email'],
  links: ['heading', 'links'],
  table: ['heading', 'intro', 'note'],
  promotions: ['eyebrow', 'heading'],
  outstation: ['eyebrow', 'heading'],
  jackpot: ['eyebrow', 'heading'],
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isObject = (value: Content): value is { readonly [key: string]: Content | undefined } => typeof value === 'object' && value !== null && !Array.isArray(value);

/** One field of a block: where it is in the content, what it is called, its words, and its place in a list (from 1). */
export interface BlockField {
  readonly path: readonly (string | number)[];
  readonly key: TextKey;
  readonly value: string;
  readonly number: number | null;
}

/** Where the walk through a block has reached: the path and key to it, its place in a list, and which order its keys follow. */
interface Place {
  readonly path: readonly (string | number)[];
  readonly key: string;
  readonly number: number | null;
  readonly order: string;
}

/** An object's entries in the page's order, not as the database keeps them (by the length of their keys). */
function inPageOrder(value: Readonly<Record<string, unknown>>, order: string): [string, unknown][] {
  const keys = PAGE_ORDER[order] ?? [];
  const rankOf = (key: string) => (keys.includes(key) ? keys.indexOf(key) : keys.length);
  return Object.entries(value).sort(([a], [b]) => rankOf(a) - rankOf(b));
}

function walk(value: unknown, at: Place): BlockField[] {
  if (typeof value === 'string') return isTextKey(at.key) ? [{ path: at.path, key: at.key, value, number: at.number }] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => walk(item, { ...at, path: [...at.path, index], number: index + 1 }));
  if (!isRecord(value)) return [];
  return inPageOrder(value, at.order).flatMap(([key, item]) => walk(item, { path: [...at.path, key], key, number: at.number, order: `${at.order}.${key}` }));
}

/** The words in a block's content the editor shows, in the order its kind draws them, each with its place. */
export function fieldsOf(kind: string, content: unknown): BlockField[] {
  return walk(content, { path: [], key: '', number: null, order: kind });
}

/** A run of fields in the editor: one item of a list of things under its own heading, or the fields around them. */
export interface FieldGroup {
  /** The list it is an item of, and its place from 1; null for the fields outside any such list. */
  readonly list: string | null;
  readonly number: number | null;
  readonly fields: readonly BlockField[];
}

/** The list a field is an item of, by where it is: a path such as `questions.0.answer`. A plain list of words has no item to head. */
function itemOf(field: BlockField): { list: string; index: number } | null {
  const [list, index, inside] = field.path;
  return typeof list === 'string' && typeof index === 'number' && inside !== undefined ? { list, index } : null;
}

/** The fields in runs, each item of a list of things in a run of its own. */
export function fieldGroups(fields: readonly BlockField[]): FieldGroup[] {
  const groups: { list: string | null; number: number | null; fields: BlockField[] }[] = [];
  for (const field of fields) {
    const item = itemOf(field);
    const [list, number] = item === null ? [null, null] : [item.list, item.index + 1];
    const last = groups.at(-1);
    if (last !== undefined && last.list === list && last.number === number) last.fields.push(field);
    else groups.push({ list, number, fields: [field] });
  }
  return groups;
}

/** The content with what is at a place replaced by `change` of it; everything else as it was, and all of it for a place it does not have. */
function changeAt(value: Content, path: readonly (string | number)[], change: (old: Content) => Content): Content {
  const [head, ...rest] = path;
  if (head === undefined) return change(value);
  if (Array.isArray(value) && typeof head === 'number') return value.map((item, index) => (index === head ? changeAt(item, rest, change) : item));
  if (isObject(value) && typeof head === 'string') {
    const child = value[head];
    return child === undefined ? value : { ...value, [head]: changeAt(child, rest, change) };
  }
  return value;
}

/** The content with the words at a place changed; everything else as it was, and all of it for a place it does not have. */
export function setAt(value: Content, path: readonly (string | number)[], next: string): Content {
  return changeAt(value, path, () => next);
}

/** The list at a place, or null where there is none. */
export function listAt(value: Content, path: readonly (string | number)[]): readonly Content[] | null {
  let at: Content | undefined = value;
  for (const step of path) {
    if (Array.isArray(at) && typeof step === 'number') at = at[step];
    else if (at !== undefined && isObject(at) && typeof step === 'string') at = at[step];
    else return null;
  }
  return Array.isArray(at) ? at : null;
}

/** An item like `value` with its words emptied: a link's page or a picture stays, and a list inside keeps one empty item. */
function emptied(value: Content, key: string | null): Content {
  if (typeof value === 'string') return key === null || isTextKey(key) ? '' : value;
  if (Array.isArray(value)) return value.slice(0, 1).map((item) => emptied(item, key));
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, item === undefined ? item : emptied(item, name)]));
  return value;
}

/** The content with a new item at the end of the list at a place, like the list's last with its words emptied (#906). */
export function itemAdded(value: Content, path: readonly (string | number)[]): Content {
  return changeAt(value, path, (list) => {
    const last = Array.isArray(list) ? list.at(-1) : undefined;
    return Array.isArray(list) && last !== undefined ? [...list, emptied(last, null)] : list;
  });
}

/** The content without the item at `index` of the list at a place (#906). */
export function itemRemoved(value: Content, path: readonly (string | number)[], index: number): Content {
  return changeAt(value, path, (list) => (Array.isArray(list) ? list.filter((_, place) => place !== index) : list));
}
