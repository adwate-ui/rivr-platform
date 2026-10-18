const LIST = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });

/** Joins names into one phrase: `Black card and Founders' Circle`, `A, B and C`. */
export function formatList(items: readonly string[]): string {
  return LIST.format(items);
}
