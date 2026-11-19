/**
 * The player app's Bonus tab (redesign of 15 Nov 2026): the member's Bonus, its history and Refer a friend. Registered when the tab first opens, so the app's first load carries none of it (#344).
 */
export const playerBonus = {
  title: 'Bonus',
  /** Someone signed in who is not a member. */
  notMember: 'Bonus is for members.',
  /** The balance's tile: its name; its line is Content's (`common.bonusLineDefault` until set; #1065, #1074). */
  balance: 'Balance',
  history: 'History',
  showEarlier: 'Show earlier',
  noHistory: 'Nothing here yet.',
  /**
   * A line's label, with its day beneath: Bonus given says its reason, `Welcome bonus`; Bonus used `Buy-in · Table 3`;
   * Bonus that ended `Expired · Buy-in bonus Tuesday`.
   */
  redeemed: 'Buy-in · {table}',
  redeemedNoTable: 'Buy-in',
  expired: 'Expired · {reason}',
  /** Bonus the club reversed (#1077); with no reason (the owner, 19 Nov). */
  reversed: 'Reversed',
  /** Under the balance while Bonus is owed (#1077): below zero until new Bonus pays it. */
  owedLine: 'Owed. New Bonus pays it first.',
  /** A high hand paid (redesign RD-25): `High hand: Straight flush, Nine high`. */
  highHand: 'High hand: {hand}',
  /** A line's Bonus: `+500`, `−1,000`. */
  plus: '+{chips}',
  minus: '−{chips}',
  /** Refer a friend (#151): the code is RIVR and the member's number. */
  referral: {
    title: 'Refer a friend',
    /** Only while a referral promotion is live (redesign RD-20); with none, the card says nothing of a reward. `{chips}` is `1,000`. */
    offer: '{chips} Bonus each. When a friend joins and takes a first seat.',
    joined: '{count} joined',
    copyLink: 'Copy link',
    shareInvite: 'Share invite',
    linkCopied: 'Invite link copied',
    copyFailed: 'Not copied. Use Share invite instead.',
    /** What Share invite sends with the member's link. */
    card: {
      message: 'Join me at RIVR Poker Club.',
    },
  },
} as const;
