import { err, ok, type Result } from '@rivr/contracts/result';
import type { RivrClient } from './client.ts';

/** One game and stake the club runs, for the website's games block. Money in paise. */
export interface SiteGame {
  readonly name: string;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly buyInMin: bigint;
  readonly buyInMax: bigint;
  readonly straddle: bigint | null;
  /** Its tables open now. */
  readonly tablesOpen: number;
  /** Members waiting for it. */
  readonly waiting: number;
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
  readonly is_open: boolean | null;
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
    straddle: row.straddle_paise === null ? null : BigInt(row.straddle_paise), tablesOpen: 0, waiting: 0,
  };
}

/** Each game once, in the floor order of its first table, with how many of its tables are open. */
export function gamesFrom(rows: readonly TableRow[]): (SiteGame & { readonly code: string })[] {
  const games = new Map<string, SiteGame>();
  for (const row of rows) {
    const game = row.table_type_code === null ? null : (games.get(row.table_type_code) ?? gameOf(row));
    if (row.table_type_code === null || game === null) continue;
    games.set(row.table_type_code, { ...game, tablesOpen: game.tablesOpen + (row.is_open ? 1 : 0) });
  }
  return [...games].map(([code, game]) => ({ ...game, code }));
}

/** The club's games and stakes and how many wait for each, from the public views, live. */
export async function fetchSiteGames(client: RivrClient): Promise<Result<SiteGame[], 'unavailable'>> {
  const [tables, lengths] = await Promise.all([
    client.from('public_table_status')
      .select('table_type_code, table_type_name, is_open, small_blind_paise, big_blind_paise, buy_in_min_paise, buy_in_max_paise, straddle_paise')
      .order('table_position'),
    client.from('public_waitlist_length').select('table_type_code, waiting'),
  ]);
  if (tables.error || lengths.error) return err('unavailable');
  const waiting = new Map(lengths.data.map((row) => [row.table_type_code, row.waiting ?? 0]));
  const codes = gamesFrom(tables.data);
  return ok(codes.map(({ code, ...game }) => ({ ...game, waiting: waiting.get(code) ?? 0 })));
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
