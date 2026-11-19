// @vitest-environment node
/**
 * The search line of #994, kept (#1015): the sample text, fixtures, golden files, comments and seeds that named points,
 * the rewards catalogue and the League (removed in #993, decision 0585) or the Academy, Learn and the graduate tier
 * (#1000, decision 0586) were reworded, and a later change could bring them back unnoticed. This searches every file git
 * tracks under apps, packages and supabase/seed, as the issue's search did, and finds them only where the two decisions
 * keep them. Each is matched in the forms the removal took out, not as a bare word: "points" is also basis points, a
 * website block's bullet points and a link that points at something, and "rewards" names Bonus and rakeback's keys.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const THIS_FILE = relative(ROOT, fileURLToPath(import.meta.url));

/** Each removed thing, in the forms it was written. */
const REMOVED = [
  { name: 'league', pattern: /\bleagues?\b/i },
  { name: 'academy', pattern: /\bacadem(?:y|ies)\b/i },
  // The graduate tier. The promotion engine keeps its `graduation` trigger (decision 0586).
  { name: 'graduate', pattern: /\bgraduat(?:e|es|ed)\b/i },
  // Learn, the feature: its name and its keys, not the verb.
  { name: 'learn', pattern: /\bLearn\b|\blearn[_.:/][a-z]/ },
  // Loyalty points: a multiplier, an amount in a fixture, points earned or held, and their keys.
  {
    name: 'points',
    pattern: new RegExp([
      String.raw`\d\s*[×x]\s*points\b`,
      String.raw`\b(?:double|triple|locked|league|loyalty)\s+points\b`,
      String.raw`\bpoints\s+(?:earned|earning|history|balance|multiplier|issued|per hour|an hour)\b`,
      String.raw`(?<!basis )\bpoints:\s*\d`,
      String.raw`points_?earning|pointsForTime|pointsPerHour|\b(?:member|venue)\.points\b`,
      String.raw`\bpoints\.(?:per_hour|rewards_rake_share|verified_bonus|daily_staff_cap|earned|give|grant|lock|unlock)\b`,
    ].join('|'), 'i'),
  },
  // The rewards catalogue and hotel nights, with their keys and screen.
  {
    name: 'rewards',
    pattern: /\brewards? catalogue\b|\bcatalogue of rewards\b|\breward items?\b|\bhotel nights?\b|\brewards\.(?:catalogue|points_history|accommodation|hand_over|manage)\b|\bplayer:rewards\b/i,
  },
] as const;
type Removed = (typeof REMOVED)[number]['name'];

/** Where a removed thing is still named, and why. */
const KEPT: Readonly<Record<string, readonly Removed[]>> = {
  // Activity's words for lines from before 15 Nov (decisions 0585 and 0586), and the tests that read them.
  'packages/i18n/src/catalogue/en/activity.ts': ['league', 'academy', 'learn', 'points'],
  'packages/i18n/src/catalogue/en/activity.test.ts': ['points'],
  'apps/console/src/features/admin/components/ActivityScreen.test.tsx': ['points'],
  // Generated from the database, whose stored TV modes keep `league` until the TVs' own issue (decision 0585).
  'packages/db/src/database.types.ts': ['league'],
  // The conversions consumer reads a value saved with the Academy booking's key (decision 0586).
  'packages/adapters/src/conversions/consumer.ts': ['academy'],
  'packages/adapters/src/conversions/consumer.test.ts': ['academy'],
  // Proves a promotion can no longer give points.
  'packages/contracts/src/promotionModel.test.ts': ['points'],
};

const NOT_TEXT = /\.(?:png|jpe?g|webp|gif|ico|woff2?|ttf|otf|pdf|mp4|apk|aab|jar|keystore|zip)$/i;

/** Every text file git tracks under the searched folders, from the repository's root, but this one, which names them all. */
function searchedFiles(): string[] {
  const listed = execFileSync('git', ['ls-files', '-z', '--', 'apps', 'packages', 'supabase/seed'], { cwd: ROOT, encoding: 'utf8' });
  return listed.split('\0').filter((file) => file !== '' && file !== THIS_FILE && !NOT_TEXT.test(file));
}

const linesOf = (file: string) => readFileSync(join(ROOT, file), 'utf8').split('\n');
const namedIn = (line: string) => REMOVED.filter(({ pattern }) => pattern.test(line)).map(({ name }) => name);

/** Each line of a file that names a removed thing the file does not keep, as `file:line: thing`. */
function leftovers(file: string): string[] {
  const kept = KEPT[file] ?? [];
  return linesOf(file).flatMap((line, index) => namedIn(line).filter((name) => !kept.includes(name)).map((name) => `${file}:${index + 1}: ${name}`));
}

/** Each thing KEPT allows a file that it no longer names, as `file: thing`. */
function staleKept(): string[] {
  return Object.entries(KEPT).flatMap(([file, names]) => {
    const named = new Set(linesOf(file).flatMap(namedIn));
    return names.filter((name) => !named.has(name)).map((name) => `${file}: ${name}`);
  });
}

describe('what the removed features left behind', () => {
  const files = searchedFiles();

  it('searches the apps, the packages and the seed, golden files and comments included', () => {
    expect(files).toEqual(expect.arrayContaining(['supabase/seed/10_people.sql', 'packages/testing/golden/money.json', 'apps/player/index.html']));
  });

  it('finds them only where decisions 0585 and 0586 keep them', () => {
    expect(files.flatMap(leftovers)).toEqual([]);
  });

  it('keeps each of them only where it is still found', () => {
    expect(staleKept()).toEqual([]);
  });

  it('matches the forms the removal took out', () => {
    const removed = ['Tier I · 1× points', 'Double points', 'points: 0', 'pointsForTime', "'points.per_hour'", 'the League',
      'Learn library', 'learn_session', 'an Academy seat', 'the graduate tier', 'the rewards catalogue', 'player:rewards/cab'];
    expect(removed.filter((line) => namedIn(line).length === 0)).toEqual([]);
  });

  it('passes over the words still in use', () => {
    const inUse = ['in basis points: 1800 is 18%', "points: ['Live tables']", 'the link points at it', 'to learn that a high hand went live',
      "'graduation'", "useFeature('rewards.bonus')", "kind: 'rewards'"];
    expect(inUse.filter((line) => namedIn(line).length > 0)).toEqual([]);
  });
});
