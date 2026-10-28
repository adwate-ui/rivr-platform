/**
 * The books that ship with RIVR (decision 0274), moved from poker-settle whole: the owner's choice of 28 Oct 2026.
 *
 * Each encoding is loaded lazily, never at import time: `() => import(...)` puts it in a chunk of its own, fetched only
 * when a member opens that book, so the app's entry costs nothing for it. These are the same files the drill gates
 * check (`pnpm --filter @rivr/drills gates` reads `sources/` with `fixtures/`), so what CI proves of a book is true of
 * the book the app opens. The engine's own parser checks each payload when it is opened.
 */

/** A book that ships with the app: its source id, title and author, and its encoding, fetched only when opened. */
export interface BuiltInSource {
  /** The payload's `source.id`, and the book's key in progress and in the app's address. */
  readonly id: string;
  readonly title: string;
  readonly author: string;
  /** The encoding as JSON, for `parsePayload`. */
  readonly load: () => Promise<unknown>;
}

export const BUILT_IN_SOURCES: readonly BuiltInSource[] = [
  {
    id: 'src_course',
    title: "The Course: Serious Hold 'Em Strategy for Smart Players",
    author: 'Ed Miller',
    load: async () => (await import('./the-course-ed-miller.json')).default,
  },
  {
    id: 'src_read_hands',
    title: "How To Read Hands At No-Limit Hold'em",
    author: 'Ed Miller',
    load: async () => (await import('./how-to-read-hands-ed-miller.json')).default,
  },
];

/** The built-in book with this id, if there is one. */
export const builtInSource = (id: string): BuiltInSource | undefined => BUILT_IN_SOURCES.find((source) => source.id === id);
