/** A super admin resets one member's counted hours from their record (redesign RD-36). `{name}` is the member's. */
export const memberHours = {
  title: 'Hours',
  intro: 'Their hours start from zero: the TV board, play-time bonuses and the Members list. Visits stay.',
  reason: 'Why they are reset',
  reset: 'Reset hours',
  /** Reset hours' second press. */
  confirm: 'Yes, reset the hours of {name}',
  done: 'Hours reset.',
  failures: {
    not_allowed: 'Only a super admin resets hours.',
    invalid: 'Give a reason of 3 to 200 characters.',
    paused: 'Paused. Nothing changes until it is lifted.',
    unavailable: 'Not reset. Try again.',
  },
} as const;
