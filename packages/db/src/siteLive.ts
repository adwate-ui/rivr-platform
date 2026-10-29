import { err, ok, type Result } from '@rivr/contracts/result';
import type { RivrClient } from './client.ts';

/** One game and stake the club runs, for the website's games block: its stakes only, never its seats or waiting (#617). Money in paise. */
export interface SiteGame {
  readonly name: string;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly buyInMin: bigint;
  readonly buyInMax: bigint;
  readonly straddle: bigint | null;
}

/** A coming tournament, for the website's calendar block. */
export interface SiteTournament {
  readonly name: string;
  readonly startsAt: Date;
  readonly buyIn: bigint;
  readonly guarantee: bigint | null;
}

interface TableRow {
  readonly table_type_code: string | null;
  readonly table_type_name: string | null;
  readonly small_blind_paise: number | null;
  readonly big_blind_paise: number | null;
  readonly buy_in_min_paise: number | null;
  readonly buy_in_max_paise: number | null;
  readonly straddle_paise: number | null;
}

function gameOf(row: TableRow): SiteGame | null {
  const { table_type_name: name, small_blind_paise: small, big_blind_paise: big, buy_in_min_paise: min, buy_in_max_paise: max } = row;
  if (name === null || small === null || big === null || min === null || max === null) return null;
  return {
    name, smallBlind: BigInt(small), bigBlind: BigInt(big), buyInMin: BigInt(min), buyInMax: BigInt(max),
    straddle: row.straddle_paise === null ? null : BigInt(row.straddle_paise),
  };
}

/** Each game once, in the floor order of its first table. */
export function gamesFrom(rows: readonly TableRow[]): SiteGame[] {
  const games = new Map<string, SiteGame>();
  for (const row of rows) {
    const game = row.table_type_code === null || games.has(row.table_type_code) ? null : gameOf(row);
    if (row.table_type_code !== null && game !== null) games.set(row.table_type_code, game);
  }
  return [...games.values()];
}

/** The club's games and stakes from the public view, without how many tables run or wait (#617). */
export async function fetchSiteGames(client: RivrClient): Promise<Result<SiteGame[], 'unavailable'>> {
  const { data, error } = await client.from('public_table_status')
    .select('table_type_code, table_type_name, small_blind_paise, big_blind_paise, buy_in_min_paise, buy_in_max_paise, straddle_paise')
    .order('table_position');
  if (error) return err('unavailable');
  return ok(gamesFrom(data));
}

/** A place in the RIVR League's standings, as the TVs show it: a first name and initial, or null for a member who hid it. */
export interface SiteStanding {
  readonly place: number;
  readonly name: string | null;
  readonly points: number;
}

/** This month's and this season's League standings (#617), each null when the League has none. */
export interface SiteLeague {
  /** The month's first day: `2026-11-01`. */
  readonly month: { readonly first: string; readonly standings: readonly SiteStanding[] } | null;
  readonly season: { readonly name: string; readonly standings: readonly SiteStanding[] } | null;
}

/** The League's standings from the public view (`public_league_table`), best first. */
export async function fetchSiteLeague(client: RivrClient): Promise<Result<SiteLeague, 'unavailable'>> {
  const { data, error } = await client.from('public_league_table').select('standing, season_name, first_month, place, display_name, points').order('place');
  if (error) return err('unavailable');
  const standings = (standing: string) => data.flatMap((row) => (row.standing === standing && row.place !== null && row.points !== null
    ? [{ place: row.place, name: row.display_name, points: row.points }] : []));
  const month = data.find((row) => row.standing === 'month');
  const season = data.find((row) => row.standing === 'season');
  return ok({
    month: month?.first_month ? { first: month.first_month, standings: standings('month') } : null,
    season: season?.season_name ? { name: season.season_name, standings: standings('season') } : null,
  });
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
  readonly pointsPerHour: readonly SiteTableRule<number>[];
  readonly rakebackBasisPoints: readonly SiteTableRule<number>[];
  readonly hotelNightHours: readonly SiteTableRule<number>[];
  readonly rewardsRakeShareBasisPoints: number | null;
  /** The visits this month after which the app offers a cab; null while no tier has cab requests. */
  readonly cabVisits: number | null;
  readonly leaguePrizes: { readonly month: string | null; readonly season: string | null };
  /** How a bad beat pays (jackpot.payout, #618): the share of the main pool, and its split, which makes 100%. */
  readonly badBeat: { readonly poolBasisPoints: number; readonly loserBasisPoints: number; readonly winnerBasisPoints: number; readonly tableBasisPoints: number } | null;
  /** What each rare hand pays, in paise (high_hand.payouts, #618); 0 pays nothing. */
  readonly highHands: { readonly royalFlush: bigint; readonly straightFlush: bigint; readonly fourOfAKind: bigint } | null;
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
  const prizes = venueWide('league.prizes');
  const rakeShare = numberIn(venueWide('points.rewards_rake_share'), 'basis_points');
  return {
    pointsPerHour: byTable('points.per_hour', 'points'),
    rakebackBasisPoints: byTable('rakeback.rate', 'basis_points').filter((rule) => rule.value > 0),
    hotelNightHours: byTable('accommodation.hours_per_night', 'hours'),
    rewardsRakeShareBasisPoints: rakeShare === 0 ? null : rakeShare,
    cabVisits: numberIn(venueWide('cab.minimum_visits'), 'visits'),
    leaguePrizes: { month: wordsIn(prizes, 'month'), season: wordsIn(prizes, 'season') },
    badBeat: badBeatFrom(venueWide('jackpot.payout')),
    highHands: highHandsFrom(venueWide('high_hand.payouts')),
  };
}

/** How a bad beat pays, or null when jackpot.payout is not set or cannot be read. */
function badBeatFrom(value: unknown): SiteRules['badBeat'] {
  const pool = numberIn(value, 'pool_basis_points');
  const loser = numberIn(value, 'loser_basis_points');
  const winner = numberIn(value, 'winner_basis_points');
  const table = numberIn(value, 'table_basis_points');
  if (pool === null || loser === null || winner === null || table === null) return null;
  return { poolBasisPoints: pool, loserBasisPoints: loser, winnerBasisPoints: winner, tableBasisPoints: table };
}

/** What each rare hand pays, or null when high_hand.payouts is not set or cannot be read. */
function highHandsFrom(value: unknown): SiteRules['highHands'] {
  const royal = numberIn(value, 'royal_flush');
  const straight = numberIn(value, 'straight_flush');
  const four = numberIn(value, 'four_of_a_kind');
  if (royal === null || straight === null || four === null) return null;
  return { royalFlush: BigInt(royal), straightFlush: BigInt(straight), fourOfAKind: BigInt(four) };
}

/** The club's rules the website shows, from the public view (`public_club_rules`). */
export async function fetchSiteRules(client: RivrClient): Promise<Result<SiteRules, 'unavailable'>> {
  const { data, error } = await client.from('public_club_rules').select('key, subject_name, subject_order, value').order('subject_order', { nullsFirst: true });
  if (error) return err('unavailable');
  return ok(rulesFrom(data));
}

/** The club's coming tournaments from the public view (`public_tournament_calendar`), soonest first. */
export async function fetchSiteCalendar(client: RivrClient): Promise<Result<SiteTournament[], 'unavailable'>> {
  const { data, error } = await client.from('public_tournament_calendar')
    .select('name, starts_at, buy_in_paise, guarantee_paise').order('starts_at');
  if (error) return err('unavailable');
  return ok(data.flatMap((row) => (row.name && row.starts_at && row.buy_in_paise !== null
    ? [{ name: row.name, startsAt: new Date(row.starts_at), buyIn: BigInt(row.buy_in_paise),
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
function questionsFrom(value: unknown): SitePromotion['questions'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const question = wordsIn(item, 'question');
    const answer = wordsIn(item, 'answer');
    return question !== null && answer !== null ? [{ question, answer }] : [];
  });
}

/** An approved post on the website's social wall (#157): its poster's handle and caption, and the post's link. */
export interface SiteWallPost {
  readonly handle: string;
  readonly caption: string;
  readonly permalink: string;
}

/** The club's newest approved Instagram posts, newest first (public_wall_posts). */
export async function fetchSiteWall(client: RivrClient): Promise<Result<SiteWallPost[], 'unavailable'>> {
  const { data, error } = await client.from('public_wall_posts').select('handle, caption, permalink, posted_at').order('posted_at', { ascending: false });
  if (error) return err('unavailable');
  return ok(data.flatMap((row) => (row.handle && row.permalink ? [{ handle: row.handle, caption: row.caption ?? '', permalink: row.permalink }] : [])));
}

/** The club's live promotion cards from the public view (`public_promotion_cards`), highest priority first. */
export async function fetchSitePromotions(client: RivrClient): Promise<Result<SitePromotion[], 'unavailable'>> {
  const { data, error } = await client.from('public_promotion_cards').select('title, detail, runs, rules, questions, is_welcome');
  if (error) return err('unavailable');
  return ok(data.flatMap((row) => (row.title
    ? [{ title: row.title, detail: row.detail, runs: row.runs, rules: row.rules ?? [], questions: questionsFrom(row.questions), isWelcome: row.is_welcome === true }]
    : [])));
}

/** The Bad Beat Jackpot's main pool now, in paise (`public_jackpot`); null when the club has none. */
export async function fetchSiteJackpot(client: RivrClient): Promise<Result<bigint | null, 'unavailable'>> {
  const { data, error } = await client.from('public_jackpot').select('main_paise');
  if (error) return err('unavailable');
  const pool = data[0]?.main_paise;
  return ok(pool === null || pool === undefined ? null : BigInt(pool));
}
