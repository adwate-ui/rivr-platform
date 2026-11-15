const PAISE_PER_RUPEE = 100n;
// The minus sign, not a hyphen, for any figure shown below nothing: `−₹1,000`, `−5` (F5-12). Files keep the hyphen.
const MINUS = '−';
// Indian grouping with Latin digits: 1,20,000 (docs/decisions/0007).
const RUPEES = new Intl.NumberFormat('en-IN');

/**
 * Formats integer paise as rupees: 1,20,00,000 paise is `₹1,20,000`. Whole rupees have no
 * decimals; paise show only when present (`₹1,20,000.50`). Never rounds. Negatives use a
 * minus sign: `−₹1,000`.
 */
export function formatMoney(paise: bigint): string {
  const sign = paise < 0n ? MINUS : '';
  const amount = paise < 0n ? -paise : paise;
  const remainder = amount % PAISE_PER_RUPEE;
  const fraction = remainder === 0n ? '' : `.${remainder.toString().padStart(2, '0')}`;
  return `${sign}₹${RUPEES.format(amount / PAISE_PER_RUPEE)}${fraction}`;
}

/**
 * Formats chips, kept in paise, as a count with no currency (#627): 5,00,000 paise of bonus is `5,000` bonus chips.
 * The player app shows no rupee. Never rounds: part of a chip shows as `5,000.50`.
 */
export function formatChips(paise: bigint): string {
  return formatMoney(paise).replace('₹', '');
}

/**
 * Formats a count with Indian grouping and no currency: hands `18,420`, `−5`; −0 is `0`. For counts: a fraction keeps
 * at most three places (`1,234.568`), so money is formatMoney's and chips formatChips'.
 */
export function formatNumber(value: number | bigint): string {
  if (typeof value === 'bigint') return value < 0n ? `${MINUS}${RUPEES.format(-value)}` : RUPEES.format(value);
  return value < 0 ? `${MINUS}${RUPEES.format(-value)}` : RUPEES.format(Math.abs(value));
}

/**
 * Formats a cash game's blinds, given in paise, as `100/200`, and its straddle after them when it has one: `100/200/400`;
 * a blind with paise keeps them: `0.50/1`.
 */
export function formatStakes(smallBlind: bigint, bigBlind: bigint, straddle: bigint | null = null): string {
  const blinds = `${formatChips(smallBlind)}/${formatChips(bigBlind)}`;
  return straddle === null ? blinds : `${blinds}/${formatChips(straddle)}`;
}

/**
 * A game's stakes, as everyone reads them: `NLH 100/200`, `NLH 100/200/500` with a straddle (audit F-122). A stake that
 * names no game is its figures alone: `100/200/500`.
 */
export function formatGameStakes(game: string | null, smallBlind: bigint, bigBlind: bigint, straddle: bigint | null = null): string {
  const stakes = formatStakes(smallBlind, bigBlind, straddle);
  return game === null ? stakes : `${game.toUpperCase()} ${stakes}`;
}

/** A stake's words as they are compared: case, commas and spaces aside, so `nlh 1000 / 2000` is `NLH 1,000/2,000`. */
const plain = (words: string) => words.toLowerCase().replace(/[\s,]/g, '');

// The game a typed name writes before its figures, as `NLH 100/200`: read only for a stake that names no game of its own.
const NAMED_GAME = /^(nlh|plo)(?=[\d.])/;

/** A stake in figures: its game, as `nlh`, or null where the stake names none; its blinds; and its straddle or null with none. */
export interface StakeFigures {
  readonly game: string | null;
  readonly smallBlind: bigint;
  readonly bigBlind: bigint;
  readonly straddle: bigint | null;
}

/**
 * A stake where a screen shows the name the admin typed (issue 990). With no straddle it is the name alone, as before.
 * With a straddle the figures are written with it, `NLH 100/200/500`: once, in place of a name that is only the stake's
 * figures, with or without the straddle and the game (`100/200`, `NLH 100/200/500`, `nlh 1000/2000`); and after any
 * other name (`Private Room · NLH 100/200/500`). A stake that names no game takes the one its name writes, if any.
 */
export function formatStakeName(name: string, stake: StakeFigures): string {
  const { smallBlind, bigBlind, straddle } = stake;
  if (straddle === null) return name;
  const game = stake.game ?? NAMED_GAME.exec(plain(name))?.[1] ?? null;
  const figures = formatGameStakes(game, smallBlind, bigBlind, straddle);
  const own = [figures, formatGameStakes(game, smallBlind, bigBlind), formatStakes(smallBlind, bigBlind, straddle), formatStakes(smallBlind, bigBlind)];
  return own.some((form) => plain(form) === plain(name)) ? figures : `${name} · ${figures}`;
}

/**
 * Formats integer paise as a plain rupee figure for a file another program reads, such as a return
 * extract: `20000.00`, no symbol or grouping, always two decimals, `-1000.50` below nothing. Never rounds.
 */
export function formatRupeesForFile(paise: bigint): string {
  const amount = paise < 0n ? -paise : paise;
  return `${paise < 0n ? '-' : ''}${amount / PAISE_PER_RUPEE}.${(amount % PAISE_PER_RUPEE).toString().padStart(2, '0')}`;
}

/** Paise as the rupees a form's field holds, for a figure being changed: `10000`, or `2500.50` with its paise. Nothing is dropped. */
export function formatRupeesForInput(paise: bigint): string {
  const sign = paise < 0n ? '-' : '';
  const size = paise < 0n ? -paise : paise;
  const rest = size % PAISE_PER_RUPEE;
  return `${sign}${size / PAISE_PER_RUPEE}${rest === 0n ? '' : `.${String(rest).padStart(2, '0')}`}`;
}
