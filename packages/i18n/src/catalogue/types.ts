import type { en } from './en/index.ts';

type Leaves<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
}[keyof T & string];

/** Every message key, for example `common.loading`. */
export type MessageKey = Leaves<typeof en>;

/** Values for `{placeholders}` in a message. */
export type MessageParams = Readonly<Record<string, string | number>>;
