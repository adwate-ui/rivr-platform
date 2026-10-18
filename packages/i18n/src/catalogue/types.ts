import type { en } from './en/index.ts';

/** Same shape as a catalogue namespace, with every message widened to `string`. */
export type Messages<T> = { readonly [K in keyof T]: T[K] extends string ? string : Messages<T[K]> };

/** The catalogue's shape, every message widened to `string`. */
export type Catalogue = Messages<typeof en>;

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

/** Every message key, for example `common.loading`. */
export type MessageKey = Leaves<typeof en>;

/** The one language RIVR ships (#186). The next part of #186 removes the type. */
export type Locale = 'en';

/** Values for `{placeholders}` in a message. */
export type MessageParams = Readonly<Record<string, string | number>>;
