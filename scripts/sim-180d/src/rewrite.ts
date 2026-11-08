/**
 * Rewrites every time call in a migration or seed file to the virtual clock.
 *
 * All of RIVR's functions pin search_path to '', so shadowing now() through the search path would not
 * reach them. The 90-day run of 28 Oct therefore rewrote the text of a copy instead, with this perl rule;
 * these patterns are the same rule. Applied migrations are never edited: only the copy in ~/.rivr-sim180.
 */

export interface RewriteCounts {
  now: number;
  clock: number;
  timestamp: number;
  date: number;
}

export interface Rewritten {
  text: string;
  counts: RewriteCounts;
}

// Not preceded by a word character or a dot, so pg_catalog.now(), sim_clock.now() and my_now() are left alone.
const FREE = '(?<![\\w.])';

const RULES: readonly { kind: keyof RewriteCounts; pattern: RegExp; replacement: string }[] = [
  { kind: 'now', pattern: new RegExp(`${FREE}now\\(\\)`, 'gi'), replacement: 'sim_clock.now()' },
  {
    kind: 'clock',
    pattern: new RegExp(`${FREE}(?:clock_timestamp|statement_timestamp|transaction_timestamp)\\(\\)`, 'gi'),
    replacement: 'sim_clock.clock_timestamp()',
  },
  // current_timestamp(0) is a different form; findRealTimeCalls reports it rather than mangling it.
  { kind: 'timestamp', pattern: new RegExp(`${FREE}current_timestamp\\b(?!\\s*\\()`, 'gi'), replacement: 'sim_clock.now()' },
  { kind: 'date', pattern: new RegExp(`${FREE}current_date\\b`, 'gi'), replacement: '(sim_clock.now())::date' },
];

export function rewriteTimeCalls(text: string): Rewritten {
  const counts: RewriteCounts = { now: 0, clock: 0, timestamp: 0, date: 0 };
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, () => {
      counts[rule.kind] += 1;
      return rule.replacement;
    });
  }
  return { text: out, counts };
}

// Time readings the rewrite does not handle. Each one left in the copy would read the real clock.
const UNHANDLED = new RegExp(
  `'now'::|${FREE}localtimestamp\\b|${FREE}localtime\\b|${FREE}current_time\\b|${FREE}current_timestamp\\(`,
  'gi',
);

export function findRealTimeCalls(text: string): string[] {
  return [...text.matchAll(UNHANDLED)].map((match) => match[0]);
}

const KINDS: readonly (keyof RewriteCounts)[] = ['now', 'clock', 'timestamp', 'date'];

export interface FileText {
  name: string;
  text: string;
}

export interface RewrittenFiles {
  files: FileText[];
  counts: RewriteCounts;
  /** `file: form` for every time reading the rewrite left on the real clock. */
  unhandled: string[];
}

/** Rewrites a set of files and totals what changed, so prepare can refuse a copy that still reads real time. */
export function rewriteFiles(files: readonly FileText[]): RewrittenFiles {
  const counts: RewriteCounts = { now: 0, clock: 0, timestamp: 0, date: 0 };
  const unhandled: string[] = [];
  const out = files.map((file) => {
    const rewritten = rewriteTimeCalls(file.text);
    for (const kind of KINDS) counts[kind] += rewritten.counts[kind];
    unhandled.push(...findRealTimeCalls(rewritten.text).map((form) => `${file.name}: ${form}`));
    return { name: file.name, text: rewritten.text };
  });
  return { files: out, counts, unhandled };
}
