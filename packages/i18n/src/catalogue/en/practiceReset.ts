/** The console's Practice reset screen (#104; features "Purge"; additions flow 16), for super admins. */
export const practiceReset = {
  title: 'Practice reset',
  notAllowed: 'Only a super admin resets the practice venue.',
  /** At the club: the reset is for the practice venue only (the owner's decision on #104). */
  notPractice: 'The club is never reset.',
  /** The numbered steps (console v3). */
  stepsLabel: 'Steps to reset the practice venue',
  switchTitle: 'Switch to the practice venue',
  inPractice: 'You are in the practice venue.',
  switch: 'Switch to practice',
  resetTitle: 'Reset the practice venue',
  resetDetail: 'Reloads its seed. Staff, devices and setup stay.',
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
  noSeed: 'No seed to reset to.',
  wrongName: 'Type the venue\'s name exactly as the rail shows it.',
  paused: 'The venue is frozen. Release it, then reset.',
  tooSoon: 'Reset a moment ago. Wait five minutes.',
  held: 'A kill-switch control at the practice venue names a member. Release it, then reset.',
  unavailable: 'Not reset. Try again.',
};

/** The console's Purge screen (#432; decision 0239), for super admins at a live venue. */
export const purge = {
  title: 'Purge',
  notAllowed: 'Only a super admin purges a venue.',
  practice: 'The practice venue uses Practice reset instead.',
  intro: 'Purging deletes the venue\'s play for good: members, visits, seats, hands, tournaments, the ledger\'s entries, promotions and messages. Its setup, staff, accounts and the audit log stay.',
  freezeFirst: 'Engage Venue freeze on Kill switch first.',
  /** The numbered steps (console v3): freeze, the ask, the archive, the purge. */
  stepsLabel: 'Steps to purge the venue',
  freezeTitle: 'Freeze the venue',
  frozen: 'The venue is frozen.',
  openKillSwitch: 'Open Kill switch',
  purgeTitle: 'The purge',
  purgeHint: 'Deletes what the table lists, for good.',
  archiveDetail: 'The only copy after the purge. Keep it.',
  askTitle: 'A second super admin asks',
  askHint: 'Another super admin carries it out, within a day.',
  askReason: 'Why the venue is purged',
  ask: 'Ask for the purge',
  /** `{time}`: when this super admin asked. */
  askedByYou: 'You asked for the purge at {time}. Another super admin carries it out within a day.',
  /** Who asked, at what `{time}`, and their `{reason}`. */
  askedBy: '{name} asked for the purge at {time}: "{reason}". Make the archive, then purge.',
  archiveTitle: 'The archive',
  archiveHint: 'Make the full encrypted archive, with the KYC photos and receipts, and keep the file: it is the only copy once the purge removes them. The purge waits for one made in the last 30 minutes.',
  kycReason: 'Why the KYC photos go in the archive',
  kycReasonHint: 'At least 10 characters, kept in the audit log: "Purging the venue: the archive keeps the only copy".',
  tableLabel: 'What the purge deletes',
  table: 'Table',
  rows: 'Rows',
  empty: 'Nothing to delete.',
  typeName: 'Type the venue\'s name to purge it',
  purge: 'Purge the venue',
  /** After the purge: `{count}` rows deleted. */
  purged: 'Purged: {count} rows deleted.',
  purgedOne: 'Purged: 1 row deleted.',
  /** The files the archive holds, removed from storage: `{files}` of them. */
  filesRemoved: '{files} files removed from storage. Only the archive holds them now.',
  filesRemovedOne: '1 file removed from storage. Only the archive holds it now.',
  /** Some did not go: `{left}` of them. Asked again within seven days of the purge. */
  filesLeft: '{left} of the venue\'s files are still in storage. Remove them within seven days.',
  filesLeftOne: '1 of the venue\'s files is still in storage. Remove it within seven days.',
  filesAgain: 'Remove the files again',
  /** On opening the screen again: `{left}` files the last purge still leaves in storage. */
  lastPurgeFiles: 'The last purge left {left} files in storage. Remove them within seven days of it.',
  lastPurgeFilesOne: 'The last purge left 1 file in storage. Remove it within seven days of it.',
};

/** Why a purge did not go through. */
export const purgeFailures = {
  notAllowed: 'Only a super admin purges a venue.',
  practice: 'The practice venue uses Practice reset instead.',
  notFrozen: 'Freeze the venue on Kill switch first.',
  noArchive: 'Make and save the full archive after freezing the venue. It counts for 30 minutes, while nothing changes.',
  wrongName: 'Type the venue\'s name exactly as it is.',
  held: 'A kill-switch control names a member. Release it, then purge.',
  changed: 'The venue changed during the archive. Clear the waitlist, archive again, then purge.',
  busy: 'Tables busy. Try again shortly.',
  second: 'A purge needs another super admin\'s ask, made since the freeze and within the day. The one who asked, or a login they made, cannot carry it out.',
  tooOften: 'Too many tries. Wait a moment.',
  unavailable: 'Not sent. Try again.',
};
