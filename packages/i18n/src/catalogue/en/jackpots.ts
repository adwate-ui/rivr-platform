/** The console's Jackpots screen (#48): the pools, paying a bad beat in chips, and reversing a payout. */
export const jackpots = {
  title: 'Jackpots',
  notAllowed: 'Your role does not include jackpots. Ask an admin if you need it.',
  main: 'Bad-beat jackpot',
  season: 'Season pool',
  freeroll: 'Freeroll pool',
  /** The payout rule in force: `{pool}`, `{loser}`, `{winner}` and `{table}` are percentages. */
  rule: 'A bad beat pays {pool}% of the jackpot: {loser}% to the loser, {winner}% to the winner, {table}% shared by the others dealt in.',
  noRule: 'No payout rule is set, so no bad beat can be paid. The owner sets it.',
  /** The form. */
  payout: 'Bad-beat payout',
  table: 'Table',
  loser: 'Loser\'s mobile number',
  winner: 'Winner\'s mobile number',
  others: 'Others dealt in',
  othersHint: 'Their mobile numbers, separated by commas. Leave it empty if nobody else was dealt in.',
  /** What the payout comes to before it is paid: amounts are formatted money, `{count}` a number. */
  preview: 'Loser {loser} · winner {winner} · {each} each to {count} others',
  previewNoOthers: 'Loser {loser} · winner {winner}',
  pay: 'Pay {total} in chips',
  paid: 'Paid. Bring the chips to the table.',
  chooseTable: 'Choose the table.',
  invalidLoser: 'Give the loser\'s 10-digit mobile number.',
  invalidWinner: 'Give the winner\'s 10-digit mobile number.',
  invalidOthers: 'Give each other player\'s 10-digit number once, separated by commas, at most nine, none of them the loser or the winner.',
  /** The history. */
  history: 'Payouts',
  noHistory: 'No bad beat has been paid yet.',
  /** A payout in the history: `{when}` is the date and IST time, `{total}` formatted money. */
  paidLine: '{when} · {table} · {loser} lost to {winner} · {total}',
  reversedLine: '{when} · Reversed: {reason} · {total} back to the jackpot',
  wasReversed: 'Reversed',
  reason: 'Why it is reversed',
  reverse: 'Reverse the payout of {when}',
  invalidReason: 'Say why, in a few words.',
  /** Why it did not go through. */
  notAllowedAction: 'Your role does not allow this.',
  notMember: 'One of those numbers is not a member here. Check the numbers.',
  refused: 'That payout was refused. Check the table and that every player is different, then try again.',
  paused: 'The venue is frozen. Jackpots are paid again once it is released.',
  switchedOff: 'Promotions are switched off, so no jackpot is paid until they are back on.',
  alreadyReversed: 'That payout is already reversed.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

export const consoleJackpots = { jackpots };
