/**
 * The record's Points and bonus chips (decision 0504; owner, 8 Nov): the two balances apart, each with its own name, line
 * and look, as Rewards shows them to the member; then each bonus line, the newest first; super admins add some by hand.
 */
export const memberBonus = {
  pointsLabel: 'Points',
  pointsLine: 'Spend on rewards.',
  pointsLineLocked: 'Spend on rewards. {locked} more locked.',
  chipsLabel: 'Bonus chips',
  /** They never expire; the floor redeems them with a buy-in as it seats the member. */
  chipsLine: 'Used with a buy-in in the seat sheet. Never expire.',
  history: 'Bonus chips history',
  /** The record's points, line by line (F-017). */
  points: {
    history: 'Points history', none: 'No points yet.', line: '{date} · {reason}', by: '{date} · {reason} · {name}',
    locked: '{date} · Locked: {reason}', released: '{date} · Released: {reason}',
    lockedBy: '{date} · Locked by {name}: {reason}', releasedBy: '{date} · Released by {name}: {reason}', plus: '+{points}', minus: '−{points}',
  },
  none: 'No bonus chips yet.',
  showEarlier: 'Show earlier',
  /** A line: `15 Nov 2026 · Welcome bonus` `+500`; `15 Nov 2026 · Buy-in · Table 3 · seated by Aditya Malhotra` `−1,000`. */
  credited: '{date} · {reason}',
  redeemed: '{date} · Buy-in · {table}',
  redeemedBy: '{date} · Buy-in · {table} · seated by {name}',
  expired: '{date} · Expired · {reason}',
  plus: '+{chips}',
  minus: '−{chips}',
  /**
   * Bonus chips added by hand (the owner, 8 Nov): super admins only, whole fifties from 50 to 1,00,000, with a reason the
   * member's history shows and the audit log keeps. `{chips}` is the number, as `1,500`.
   */
  give: {
    title: 'Add bonus chips',
    intro: 'For super admins. Added to the balance at once, with your reason in their history.',
    chips: 'Bonus chips',
    chipsHint: 'Whole fifties, 50 to 1,00,000.',
    /** Apart from the points' own Reason in the same card. */
    reason: 'Reason for chips',
    reasonHint: 'The member sees it in their history.',
    add: 'Add bonus chips',
    confirm: 'Yes, add {chips} bonus chips',
    added: '{chips} bonus chips added.',
    failures: {
      not_allowed: 'Super admins only.',
      own_record: 'Not to yourself. Ask another super admin.',
      invalid_chips: 'Give whole fifties from 50 to 1,00,000.',
      invalid_reason: 'Give a reason of 3 to 200 characters.',
      paused: 'Frozen, or promotions stopped. Try once released.',
      unavailable: 'Not added. Try again.',
    },
  },
};
