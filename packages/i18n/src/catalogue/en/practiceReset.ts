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

/** The console's Purge screen (#432; decision 0239), for super admins at a live venue. */
export const purge = {
  title: 'Purge',
  notAllowed: 'Only a super admin purges a venue.',
  practice: 'The practice venue resets to its seed instead, on Practice reset.',
  intro: 'Purging deletes the venue\'s play for good: members, visits, seats, hands, tournaments, the ledger\'s entries, promotions and messages. Its setup, staff, accounts and the audit log stay.',
  freezeFirst: 'Freeze the venue on Kill switch first, so nothing changes between the archive and the purge.',
  archiveTitle: 'The archive',
  archiveHint: 'Make the full encrypted archive and keep the file. The purge waits for one made in the last 30 minutes.',
  tableLabel: 'What the purge deletes',
  table: 'Table',
  rows: 'Rows',
  empty: 'Nothing to delete.',
  typeName: 'Type the venue\'s name to purge it',
  purge: 'Purge the venue',
  done: 'Purged: {count} rows deleted.',
};

/** Why a purge did not go through. */
export const purgeFailures = {
  notAllowed: 'Only a super admin purges a venue.',
  practice: 'The practice venue resets to its seed instead, on Practice reset.',
  notFrozen: 'Freeze the venue on Kill switch first.',
  noArchive: 'Make and save the full archive first. It counts for 30 minutes.',
  wrongName: 'Type the venue\'s name exactly as it is.',
  held: 'A kill-switch control names a member. Release it, then purge.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
