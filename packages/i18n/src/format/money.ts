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
 * Formats a count with Indian grouping and no currency: points `18,420`, `−5`; −0 is `0`. For counts: a fraction keeps
 * at most three places (`1,234.568`), so money is formatMoney's and chips formatChips'.
 */
export function formatNumber(value: number | bigint): string {
  if (typeof value === 'bigint') return value < 0n ? `${MINUS}${RUPEES.format(-value)}` : RUPEES.format(value);
  return value < 0 ? `${MINUS}${RUPEES.format(-value)}` : RUPEES.format(Math.abs(value));
}

/** Formats hotel nights, kept in thousandths (#146, decision 0246): `2`, `1.25`, `0.175`, `1,200.5`. */
export function formatNights(thousandths: bigint): string {
  const size = thousandths < 0n ? -thousandths : thousandths;
  const whole = RUPEES.format(size / 1_000n);
  const rest = size % 1_000n;
  const sign = thousandths < 0n ? MINUS : '';
  return rest === 0n ? `${sign}${whole}` : `${sign}${whole}.${rest.toString().padStart(3, '0').replace(/0+$/, '')}`;
}

/** Formats a cash game's blinds, given in paise, as `100/200`; a blind with paise keeps them: `0.50/1`. */
export function formatStakes(smallBlind: bigint, bigBlind: bigint): string {
  return `${formatChips(smallBlind)}/${formatChips(bigBlind)}`;
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
