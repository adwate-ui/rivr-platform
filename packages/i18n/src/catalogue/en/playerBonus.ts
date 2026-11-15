/**
 * The player app's Bonus tab (redesign of 15 Nov 2026): the member's Bonus, its history and Refer a friend. Registered when the tab first opens, so the app's first load carries none of it (#344).
 */
export const playerBonus = {
  title: 'Bonus',
  /** Someone signed in who is not a member. */
  notMember: 'Bonus is for members.',
  /** The balance's tile: its name, and one line on what it is for. */
  balance: 'Balance',
  line: 'Use with your buy-in. Never expires.',
  history: 'History',
  showEarlier: 'Show earlier',
  noHistory: 'Nothing here yet.',
  /** A line's label, with its day: `Welcome bonus · 15 Nov`; `Buy-in · Table 3 · 15 Nov`; `Expired · Buy-in bonus Tuesday · 9 Nov`. */
  credited: '{reason} · {date}',
  /** A high hand paid (redesign RD-25): `High hand: Straight flush, Nine high · 15 Nov`. */
  highHand: 'High hand: {hand} · {date}',
  redeemed: 'Buy-in · {table} · {date}',
  redeemedNoTable: 'Buy-in · {date}',
  expired: 'Expired · {reason} · {date}',
  /** A line's Bonus: `+500`, `−1,000`. */
  plus: '+{chips}',
  minus: '−{chips}',
  /** Refer a friend (#151): the code is RIVR and the member's number. */
  referral: {
    title: 'Refer a friend',
    how: 'Bonus for you both when a friend joins with your code and takes a first seat.',
    /** `{chips}` is `1,000`. */
    offer: '{chips} Bonus each when a friend joins and takes a first seat.',
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
