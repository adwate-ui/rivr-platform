import { err, ok, type Result } from '@rivr/contracts/result';
import type { RivrClient } from './client.ts';
import { LIST_MOST } from './limits.ts';

/** One game and stake the club runs, for the website's games block: its stakes only, never its seats or waiting (#617). Money in paise. */
export interface SiteGame {
  readonly name: string;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  /** The least of its tables' own minimum buy-ins (redesign RD-16); there is no maximum. */
  readonly buyInMin: bigint;
  readonly straddle: bigint | null;
}

/** A coming tournament, for the website's calendar block. */
export interface SiteTournament {
  readonly name: string;
  readonly startsAt: Date;
  /** Null for a tournament published without money (decision 0441). */
  readonly buyIn: bigint | null;
  readonly guarantee: bigint | null;
}

interface TableRow {
  readonly table_type_code: string | null;
  readonly table_type_name: string | null;
  readonly small_blind_paise: number | null;
  readonly big_blind_paise: number | null;
  readonly buy_in_min_paise: number | null;
  readonly straddle_paise: number | null;
}

function gameOf(row: TableRow): SiteGame | null {
  const { table_type_name: name, small_blind_paise: small, big_blind_paise: big, buy_in_min_paise: min } = row;
  if (name === null || small === null || big === null || min === null) return null;
  return {
    name, smallBlind: BigInt(small), bigBlind: BigInt(big), buyInMin: BigInt(min),
    straddle: row.straddle_paise === null ? null : BigInt(row.straddle_paise),
  };
}

/** Each game once, in the floor order of its first table, with the least of its tables' minimum buy-ins. */
export function gamesFrom(rows: readonly TableRow[]): SiteGame[] {
  const games = new Map<string, SiteGame>();
  for (const row of rows) {
    const game = row.table_type_code === null ? null : gameOf(row);
    if (row.table_type_code === null || game === null) continue;
    const first = games.get(row.table_type_code);
    if (first === undefined) games.set(row.table_type_code, game);
    else if (game.buyInMin < first.buyInMin) games.set(row.table_type_code, { ...first, buyInMin: game.buyInMin });
  }
  return [...games.values()];
}

/** The club's games and stakes from the public view, without how many tables run or wait (#617). */
export async function fetchSiteGames(client: RivrClient): Promise<Result<SiteGame[], 'unavailable'>> {
  const { data, error } = await client.from('public_table_status')
    .select('table_type_code, table_type_name, small_blind_paise, big_blind_paise, buy_in_min_paise, straddle_paise')
    .order('table_position').limit(LIST_MOST);
  if (error) return err('unavailable');
  return ok(gamesFrom(data));
}

/** A rule set for one table type, by its name, in the order of its stakes. */
export interface SiteTableRule<T> {
  readonly table: string;
  readonly value: T;
}

/**
 * The club's rules the website shows (#617), each as in force now (`public_club_rules`): a rule not set is empty, or null.
 * Rates are in basis points (500 is 5%).
 */
export interface SiteRules {
  readonly rakebackBasisPoints: readonly SiteTableRule<number>[];
  /** The visits this month after which the app offers a cab; null while no tier has cab requests. */
  readonly cabVisits: number | null;
}

interface RuleRow {
  readonly key: string | null;
  readonly subject_name: string | null;
  readonly value: unknown;
}

/** A field of a rule's value: a whole number, or words. */
function field(value: unknown, name: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return Object.entries(value).find(([key]) => key === name)?.[1];
}
const numberIn = (value: unknown, name: string) => { const found = field(value, name); return typeof found === 'number' ? found : null; };
const wordsIn = (value: unknown, name: string) => { const found = field(value, name); return typeof found === 'string' ? found : null; };

/** The rules from their rows: each table type's in the order given, each venue-wide one once. */
export function rulesFrom(rows: readonly RuleRow[]): SiteRules {
  const byTable = (key: string, name: string) => rows.flatMap((row) => {
    const value = row.key === key ? numberIn(row.value, name) : null;
    return value !== null && row.subject_name !== null ? [{ table: row.subject_name, value }] : [];
  });
  const venueWide = (key: string) => rows.find((row) => row.key === key)?.value;
  return {
    rakebackBasisPoints: byTable('rakeback.rate', 'basis_points').filter((rule) => rule.value > 0),
    cabVisits: numberIn(venueWide('cab.minimum_visits'), 'visits'),
  };
}

/** The club's rules the website shows, from the public view (`public_club_rules`). */
export async function fetchSiteRules(client: RivrClient): Promise<Result<SiteRules, 'unavailable'>> {
  const { data, error } = await client.from('public_club_rules').select('key, subject, subject_name, subject_order, value')
    .order('subject_order', { nullsFirst: true }).order('subject').limit(LIST_MOST);
  if (error) return err('unavailable');
  return ok(rulesFrom(data));
}

/** The club's coming tournaments from the public view (`public_tournament_calendar`), soonest first. */
export async function fetchSiteCalendar(client: RivrClient): Promise<Result<SiteTournament[], 'unavailable'>> {
  const { data, error } = await client.from('public_tournament_calendar')
    .select('name, starts_at, buy_in_paise, guarantee_paise').order('starts_at').limit(LIST_MOST);
  if (error) return err('unavailable');
  return ok(data.flatMap((row) => (row.name && row.starts_at
    ? [{ name: row.name, startsAt: new Date(row.starts_at), buyIn: row.buy_in_paise === null ? null : BigInt(row.buy_in_paise),
         guarantee: row.guarantee_paise === null ? null : BigInt(row.guarantee_paise) }]
    : [])));
}

/** A live promotion, for the website's promotions block (decision 0166): as published, with its rules and questions (#618). */
export interface SitePromotion {
  readonly title: string;
  readonly detail: string | null;
  readonly runs: string | null;
  readonly rules: readonly string[];
  readonly questions: readonly { readonly question: string; readonly answer: string }[];
  /** For new players: the welcome offer. */
  readonly isWelcome: boolean;
}

/** A promotion's questions as the view gives them, leaving out any it cannot read. */
export function questionsFrom(value: unknown): SitePromotion['questions'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const question = wordsIn(item, 'question');
    const answer = wordsIn(item, 'answer');
    return question !== null && answer !== null ? [{ question, answer }] : [];
  });
}

/** The club's live promotion cards from the public view (`public_promotion_cards`), highest priority first. */
export async function fetchSitePromotions(client: RivrClient): Promise<Result<SitePromotion[], 'unavailable'>> {
  const { data, error } = await client.from('public_promotion_cards').select('title, detail, runs, rules, questions, is_welcome').limit(LIST_MOST);
  if (error) return err('unavailable');
  return ok(data.flatMap((row) => (row.title
    ? [{ title: row.title, detail: row.detail, runs: row.runs, rules: row.rules ?? [], questions: questionsFrom(row.questions), isWelcome: row.is_welcome === true }]
    : [])));
}
