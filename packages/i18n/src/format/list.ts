import type { Locale } from '../catalogue/types.ts';

const INTL_LOCALE: Record<Locale, string> = { en: 'en-GB' };

/** Joins names into one phrase: `Black card and Founders' Circle`, `A, B and C`. */
export function formatList(items: readonly string[], locale: Locale): string {
  return new Intl.ListFormat(INTL_LOCALE[locale], { style: 'long', type: 'conjunction' }).format(items);
}
