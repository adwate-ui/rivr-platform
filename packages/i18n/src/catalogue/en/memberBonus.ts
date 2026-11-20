/**
 * The record's bonus chips (decision 0504; owner, 8 Nov): the balance with its name, line and look, as the app shows it to the
 * member; then each bonus line, the newest first; bonus chips are added by hand here, on the record.
 */
export const memberBonus = {
  chipsLabel: 'Bonus',
  /** The Members list's column: each member's Bonus in force (redesign RD-29). */
  column: 'Bonus',
  /** They never expire; the floor redeems them with a buy-in as it seats the member, or uses them with Use Bonus. */
  chipsLine: 'Used with a seat\'s buy-in or with Use Bonus. Never expires.',
  history: 'Bonus history',
  none: 'No Bonus yet.',
  showEarlier: 'Show earlier',
  /** A line: `15 Nov 2026 · Welcome bonus` `+500`; `15 Nov 2026 · Buy-in · Table 3 · seated by Aditya Malhotra` `−1,000`. */
  credited: '{date} · {reason}',
  redeemed: '{date} · Buy-in · {table}',
  redeemedBy: '{date} · Buy-in · {table} · seated by {name}',
  /** A use added after the fact (#1077), with its reason and the super admin who added it. */
  redeemedAdded: '{date} · Buy-in · {table} · {reason} · added by {name}',
  /** Bonus used without a seat (the owner, 20 Nov): `20 Nov 2026 · Used · Chips for the bar · by Aditya Malhotra` `−200`. */
  used: '{date} · Used · {reason} · by {name}',
  expired: '{date} · Expired · {reason}',
  /** A Bonus a super admin reversed (#1077): `19 Nov 2026 · Reversed · Wrong member · by Vikram Rao` `−2,000`. */
  reversed: '{date} · Reversed · {reason}',
  reversedBy: '{date} · Reversed · {reason} · by {name}',
  /** The tile's line while Bonus is owed (#1077): the balance is below zero until new Bonus pays it. */
  owedLine: 'Owed. New Bonus pays it first.',
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
  /**
   * Bonus used without a seat (the owner, 20 Nov), by those who add it by hand: while the member is checked in, whole
   * fifties, never more than they hold or their visit's limit, with a reason. `{chips}` is the number, as `1,500`.
   */
  use: {
    title: 'Use Bonus',
    chips: 'Bonus',
    chipsHint: 'Whole fifties, while checked in.',
    reason: 'Reason',
    /** The member sees no reason for a use, as for a use added. */
    reasonHint: 'Kept on the record and in Activity.',
    use: 'Use Bonus',
    confirm: 'Yes, use {chips} Bonus',
    used: '{chips} Bonus used.',
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      own_record: 'Not on your own record. Ask someone else who can.',
      invalid_chips: 'Give whole fifties from 50 to 1,00,000.',
      invalid_reason: 'Give a reason of 3 to 200 characters.',
      not_checked_in: 'Not checked in. Check them in first.',
      /** More than the Bonus in force, or some is owed. */
      bonus_short: 'More than their Bonus. Type less.',
      /** More than the visit's limit leaves (bonus.visit_cap). */
      visit_cap: 'More than this visit allows. Type less.',
      paused: 'Frozen, or promotions stopped. Try once released.',
      busy: 'Too many at once. Try again shortly.',
      unavailable: 'Not used. Try again.',
    },
  },
  /**
   * A super admin reverses a Bonus given from its row (#1077, the owner, 18 Nov): all of it comes back, even if used, less
   * what expired. `{chips}` is `2,000`; `what` reads `2,000 given 18 Nov 2026 · Welcome bonus`.
   */
  reverse: {
    title: 'Reverse Bonus',
    what: '{chips} given {date} · {reason}',
    /** Part of it expired, which went back then. */
    expired: '{chips} of it expired.',
    reason: 'Reason',
    /** The member sees no reason for a reversal (the owner, 19 Nov). */
    reasonHint: 'Kept on the record and in Activity.',
    action: 'Reverse',
    cancel: 'Cancel',
    /** `{chips}` is what came back. */
    done: '{chips} Bonus reversed.',
    already: 'Already reversed.',
    /** What a screen reader hears after a Bonus given that opens this. */
    openHint: 'Reverse',
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      own_record: 'Not on your own record. Ask another super admin.',
      invalid_chips: 'Give whole fifties from 50 to 1,00,000.',
      invalid: 'Give a reason of 3 to 200 characters.',
      nothing_left: 'Nothing left to take back. It expired.',
      paused: 'Frozen, or promotions stopped. Try once released.',
      busy: 'Too many at once. Try again shortly.',
      unavailable: 'Not reversed. Try again.',
    },
  },
  /**
   * A super admin adds a Bonus use a seat missed (#1077): any seat of the member's, whole fifties and a reason. It
   * counts on that seat's day, with no visit limit. `seatLine` reads `Table 5 · seat 7 · 18 Nov 2026, 22:10`.
   */
  missedUse: {
    title: 'Missed Bonus use',
    seat: 'Seat',
    seatLine: '{table} · seat {seat} · {when}',
    noSeats: 'No seats to add a use to.',
    chips: 'Bonus used',
    chipsHint: 'Whole fifties. No visit limit.',
    reason: 'Reason',
    /** The member sees no reason for a use added (the owner, 19 Nov). */
    reasonHint: 'Kept on the record and in Activity.',
    add: 'Add use',
    confirm: 'Yes, take {chips} Bonus',
    added: '{chips} Bonus use added.',
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      own_record: 'Not on your own record. Ask another super admin.',
      invalid_chips: 'Give whole fifties from 50 to 1,00,000.',
      invalid: 'Pick a seat and give a reason.',
      nothing_left: 'Nothing left to take back. It expired.',
      paused: 'Frozen, or promotions stopped. Try once released.',
      busy: 'Too many at once. Try again shortly.',
      unavailable: 'Not added. Try again.',
    },
  },
};
