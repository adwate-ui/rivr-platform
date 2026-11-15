/**
 * The record's bonus chips (decision 0504; owner, 8 Nov): the balance with its name, line and look, as the app shows it to the
 * member; then each bonus line, the newest first; bonus chips are added by hand here, on the record.
 */
export const memberBonus = {
  chipsLabel: 'Bonus chips',
  /** They never expire; the floor redeems them with a buy-in as it seats the member. */
  chipsLine: 'Used with a buy-in in the seat sheet. Never expire.',
  history: 'Bonus chips history',
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
   * Bonus chips added by hand: super admins, admins and floor managers (the owner, 9 Nov), whole fifties from 50 to 1,00,000, with a reason the
   * member's history shows and the audit log keeps. `{chips}` is the number, as `1,500`.
   */
  give: {
    title: 'Add bonus chips',
    intro: 'Added to the balance at once, with your reason in their history.',
    chips: 'Bonus chips',
    chipsHint: 'Whole fifties, 50 to 1,00,000.',
    reason: 'Reason for chips',
    reasonHint: 'The member sees it in their history.',
    add: 'Add bonus chips',
    confirm: 'Yes, add {chips} bonus chips',
    added: '{chips} bonus chips added.',
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      own_record: 'Not to yourself. Ask someone else who can.',
      invalid_chips: 'Give whole fifties from 50 to 1,00,000.',
      invalid_reason: 'Give a reason of 3 to 200 characters.',
      paused: 'Frozen, or promotions stopped. Try once released.',
      /** Past the staff member's daily limit on bonus chips by hand; the owner is told. */
      daily_limit: 'Past your daily limit for adding bonus chips. A super admin can add more.',
      /** Above the most the club adds by hand at once (bonus.by_hand_cap). */
      over_cap: 'More than the club adds at once. Type less.',
      unavailable: 'Not added. Try again.',
    },
  },
};
