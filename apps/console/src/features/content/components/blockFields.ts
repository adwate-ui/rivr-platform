/** The words in a block the editor offers to change; links, pictures and addresses stay as they are. */
export const TEXT_KEYS = [
  'eyebrow', 'heading', 'text', 'note', 'body', 'intro', 'title', 'label', 'alt', 'quote', 'question', 'answer', 'apply', 'address', 'hours',
  'value', 'phone', 'email', 'when', 'lines', 'points', 'rules', 'phrases', 'paragraphs',
] as const;
export type TextKey = (typeof TEXT_KEYS)[number];

/** A block's content as the database keeps it: JSON. */
export type Content = string | number | boolean | null | Content[] | { readonly [key: string]: Content | undefined };

const isTextKey = (key: string): key is TextKey => TEXT_KEYS.some((known) => known === key);
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isObject = (value: Content): value is { readonly [key: string]: Content | undefined } => typeof value === 'object' && value !== null && !Array.isArray(value);

/** One field of a block: where it is in the content, what it is called, its words, and its place in a list (from 1). */
export interface BlockField {
  readonly path: readonly (string | number)[];
  readonly key: TextKey;
  readonly value: string;
  readonly number: number | null;
}

/** The words in a block's content the editor shows, in order, each with its place. */
export function fieldsOf(value: unknown, path: readonly (string | number)[] = [], key = '', number: number | null = null): BlockField[] {
  if (typeof value === 'string') return isTextKey(key) ? [{ path, key, value, number }] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => fieldsOf(item, [...path, index], key, index + 1));
  if (isRecord(value)) return Object.entries(value).flatMap(([name, item]) => fieldsOf(item, [...path, name], name, number));
  return [];
}

/** The content with the words at a place changed; everything else as it was, and all of it for a place it does not have. */
export function setAt(value: Content, path: readonly (string | number)[], next: string): Content {
  const [head, ...rest] = path;
  if (head === undefined) return next;
  if (Array.isArray(value) && typeof head === 'number') return value.map((item, index) => (index === head ? setAt(item, rest, next) : item));
  if (isObject(value) && typeof head === 'string') {
    const child = value[head];
    return child === undefined ? value : { ...value, [head]: setAt(child, rest, next) };
  }
  return value;
}
