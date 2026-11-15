/**
 * The record's bonus chips (decision 0504; owner, 8 Nov): the balance with its name, line and look, as the app shows it to the
 * member; then each bonus line, the newest first; bonus chips are added by hand here, on the record.
 */
export const memberBonus = {
  chipsLabel: 'Bonus',
  /** The Members list's column: each member's Bonus in force (redesign RD-29). */
  column: 'Bonus',
  /** They never expire; the floor redeems them with a buy-in as it seats the member. */
  chipsLine: 'Used with a buy-in in the seat sheet. Never expires.',
  history: 'Bonus history',
  none: 'No Bonus yet.',
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
    title: 'Add Bonus',
    intro: 'Added to the balance at once, with your reason in their history.',
    chips: 'Bonus',
    /** `{most}` is the most this person adds at once: the club's cap for an admin or a floor manager, else 1,00,000. */
    chipsHint: 'Whole fifties, 50 to {most}.',
    reason: 'Reason',
    reasonHint: 'The member sees it in their history.',
    add: 'Add Bonus',
    confirm: 'Yes, add {chips} Bonus',
    added: '{chips} Bonus added.',
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      own_record: 'Not to yourself. Ask someone else who can.',
      invalid_chips: 'Give whole fifties from 50 to 1,00,000.',
      invalid_reason: 'Give a reason of 3 to 200 characters.',
      paused: 'Frozen, or promotions stopped. Try once released.',
      /** Past the staff member's daily limit on bonus chips by hand; the owner is told. */
      daily_limit: 'Past your daily limit for adding Bonus. A super admin can add more.',
      /** Above the most an admin or a floor manager adds by hand at once (bonus.by_hand_cap). */
      over_cap: 'More than staff add at once. Type less, or ask a super admin.',
      unavailable: 'Not added. Try again.',
    },
  },
};
