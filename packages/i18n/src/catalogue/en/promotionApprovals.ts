/** Bonus a promotion calculated, waiting for a super admin (decision 0670): the words of the Promotions tab To approve. */
export const promotionApprovals = {
  label: 'Bonus to approve',
  search: 'Member or promotion',
  empty: 'Nothing waits for approval.',
  columns: { member: 'Member', promotion: 'Promotion', amount: 'Bonus', why: 'Why', when: 'When', decide: 'Decide', seated: 'Seated', left: 'Left', away: 'Away', played: 'Played' },
  /** A play-time row's Left while the player still sits (#1061). */
  stillSeated: 'Still seated',
  /** Corrects a play-time row's session (#1061), in the panel at the side. */
  correct: 'Correct',
  correctNamed: 'Correct the session of {name}',
  correction: {
    title: 'Correct session',
    subtitle: '{name} · {promotion}',
    /** One seat of the visit: `Table 3 · from 21:40`; one still taken ends at the table, so only its time away is corrected. */
    seat: '{table} · from {from}',
    seatOpen: '{table} · from {from} · still seated',
    leftAt: 'Left at',
    leftAtHint: '24-hour, IST: 23:40',
    away: 'Away',
    awayHint: 'Taken off the time played.',
    reason: 'Why it is corrected',
    reasonHint: 'Kept in Activity.',
    badTime: 'Type a time as 23:40.',
    badAway: 'Type whole minutes, 0 or more.',
    unchanged: 'Change a time first.',
    save: 'Save correction',
    /** Saved: how many waiting steps the corrected time no longer reaches, refused, and how many given above it, which stay. */
    saved: 'Session corrected',
    savedRefused: 'Session corrected · {count} waiting refused',
    savedGivenAbove: 'Session corrected · {count} already given stays',
    savedBoth: 'Session corrected · {refused} waiting refused · {given} already given stays',
    failures: {
      not_allowed: 'Only a super admin corrects a session.',
      own_record: 'Not your own record. Ask another super admin.',
      invalid: 'Those times do not fit the seat.',
      paused: 'Frozen. Try again once it is released.',
      switched_off: 'Promotions are switched off.',
      unavailable: 'Not saved. Try again.',
    },
  },
  /** The member, as the queue names them: `Ishaan Verma · No. 7`. */
  member: '{name} · No. {number}',
  /** What set the Bonus off. A seat names its table; play time, the step reached: `4 h played`. */
  why: {
    signup: 'Sign-up', referral: 'Referral', check_in: 'Visit', seated: 'Seat', seatedAt: 'Seat at {table}', hours_step: 'Play time',
    hoursStep: '{time} played', hours_played: 'Hours played', other: 'Promotion',
  },
  approve: 'Approve',
  approveNamed: 'Approve {amount} Bonus for {name}',
  refuse: 'Refuse',
  refuseNamed: 'Refuse {amount} Bonus for {name}',
  /** Approves every row of the page on screen. */
  approveShown: 'Approve all shown',
  /** The panel that refuses the chosen, with one reason. */
  refuseTitle: 'Refuse {count}',
  reason: 'Why it is refused',
  reasonHint: 'Kept on the record. The member is not told.',
  invalidReason: 'Write a reason of 3 to 200 characters.',
  cancel: 'Cancel',
  /** What a decision did, from the server's count. */
  approved: '{count} approved · {amount} Bonus',
  approvedLeft: '{count} approved · {amount} Bonus · {left} left waiting (frozen)',
  /** Asked before Bonus is approved in bulk, ticked or all shown. */
  confirmApprove: 'Approve {count} · {amount} Bonus?',
  confirmApproveYes: 'Yes, approve {count}',
  refused: '{count} refused',
  alreadyDecided: 'Already decided by another super admin.',
  failures: {
    not_allowed: 'Only a super admin approves Bonus.',
    own_record: 'Not your own Bonus. Ask another super admin.',
    invalid: 'Choose at least one, and give a reason to refuse.',
    paused: 'Venue frozen. Try again once it is released.',
    switched_off: 'Promotions are switched off.',
    unavailable: 'Not saved. Try again.',
  },
} as const;
