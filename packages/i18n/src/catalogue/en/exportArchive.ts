/** The console's Exports screen (#103; features "Exports"; decision 0232), for super admins. */
export const exportArchive = {
  title: 'Exports',
  notAllowed: 'Only a super admin makes an export archive.',
  fullTitle: 'Full archive',
  fullIntro: 'Every table of this venue as CSV, with a manifest of the rows in each, in one file locked to the owner\'s backup key: only that key opens it (age -d). The audit log keeps who made it.',
  kycPhotos: 'Include KYC photos',
  kycPhotosHint: 'Only with a written reason, which the audit log keeps.',
  kycReason: 'Why the photos are needed',
  make: 'Make the archive',
  memberTitle: 'One member\'s data',
  memberIntro: 'For an access request: every row about one member, in the same locked archive. Open it, take out staff notes the member is not owed, then send it.',
  memberSearch: 'Find the member by name, mobile or member number',
  memberNone: 'No member found.',
  memberExport: 'Export {name}, No. {number}',
  readingTable: 'Reading {name}: table {done} of {of}',
  readingPhotos: 'Reading KYC photos: {done} of {of}',
  locking: 'Locking the archive to the owner\'s key',
  done: 'Saved {file}. Rows: {rows}. Tables: {tables}. KYC photos: {photos}.',
  /** KYC photos that could not be read: the manifest lists them. */
  photosUnread: 'KYC photos not read: {count}. The manifest lists them.',
};

/** Why an archive was not made. Nothing is saved. */
export const exportArchiveFailures = {
  notAllowed: 'Only a super admin makes an export archive.',
  noKey: 'Set the owner\'s backup key first: Settings, exports.archive_recipient.',
  noMember: 'That member is not at this venue. Search again and choose from the list.',
  reasonShort: 'Write why the photos are needed, in 10 characters or more.',
  unavailable: 'The archive could not be made, and nothing was saved. Check the connection and try again.',
};
