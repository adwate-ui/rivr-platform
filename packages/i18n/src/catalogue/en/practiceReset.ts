/** The console's Practice reset screen (#104; features "Purge"; additions flow 16), for super admins. */
export const practiceReset = {
  title: 'Practice reset',
  notAllowed: 'Only a super admin resets the practice venue.',
  /** At the club: the reset is for the practice venue only (the owner's decision on #104). */
  notPractice: 'Switch on Practice venue at the foot of the rail to reset it. The club is never reset.',
  intro: 'Reset to seed brings the practice venue back to how it was seeded: members, visits, seats, hands, the cage, the ledger, promotions and tournaments. Staff, devices, settings, tables, SOPs, quizzes, every certification attempt, contacts, drills and kill-switch controls stay. The audit log keeps the reset.',
  /** The dry run's table. */
  tableLabel: 'Tables a reset reloads',
  table: 'Table',
  now: 'Rows now',
  seed: 'Rows in the seed',
  empty: 'Nothing to reset.',
  matches: 'Every table matches the seed.',
  differs: 'Some tables differ from the seed. A reset brings them back.',
  typeName: 'Type the venue\'s name to confirm',
  reset: 'Reset to seed',
  done: 'The practice venue is back to its seed.',
};

/** Why a reset to seed did not go through. */
export const practiceResetFailures = {
  notAllowed: 'Only a super admin resets the practice venue.',
  notPractice: 'Only the practice venue resets to its seed.',
  noSeed: 'This venue has no seed to reset to. Ask for one to be captured first.',
  wrongName: 'Type the venue\'s name exactly as the rail shows it.',
  paused: 'The venue is frozen. Release it, then reset.',
  tooSoon: 'The practice venue was reset a moment ago. Wait five minutes, then reset again.',
  held: 'A kill-switch control at the practice venue names a member. Release it, then reset.',
  unavailable: 'The reset did not go through. Check the connection and try again.',
};
