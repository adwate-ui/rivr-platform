import { en } from './catalogue/en/index.ts';
import type { Catalogue, Locale, MessageKey, MessageParams } from './catalogue/types.ts';

const CATALOGUES: Record<Locale, Catalogue> = { en };

/** Translates one message key. `{name}` placeholders are filled from `params`. */
export type Translate = (key: MessageKey, params?: MessageParams) => string;

function lookup(catalogue: Catalogue, key: MessageKey): string {
  let node: unknown = catalogue;
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? Reflect.get(node, part) : undefined;
  }
  // The key type makes a miss impossible; showing the key beats showing nothing if it happens.
  return typeof node === 'string' ? node : key;
}

function fill(message: string, params: MessageParams): string {
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}

/** Returns the translate function for a locale. */
export function createTranslator(locale: Locale): Translate {
  const catalogue = CATALOGUES[locale];
  return (key, params = {}) => fill(lookup(catalogue, key), params);
}
