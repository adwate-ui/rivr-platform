/** A super admin resets one member's counted hours from their record (redesign RD-36). `{name}` is the member's. */
export const memberHours = {
  title: 'Hours',
  intro: 'Hours start again from zero. Visits stay.',
  reason: 'Why they are reset',
  reset: 'Reset hours',
  /** Reset hours' second press. */
  confirm: 'Yes, reset the hours of {name}',
  done: 'Hours reset.',
  failures: {
    not_allowed: 'Only a super admin resets hours.',
    own_record: 'You cannot reset your own hours. Ask another super admin.',
    invalid: 'Give a reason of 3 to 200 characters.',
    paused: 'Paused. Nothing changes until it is lifted.',
    unavailable: 'Not reset. Try again.',
  },
} as const;
