/**
 * The console's Tournaments screen (redesign RD-26): the club's tournaments to come and past, who asked to be notified,
 * the notification sent once, and a past one's entries. No registration, tickets or payments.
 */
export const tournaments = {
  title: 'Tournaments',
  newTournament: 'New tournament',
  search: 'Find a tournament',
  /** The two lists, each with how many it holds: `Upcoming 2`. */
  tabs: { upcoming: 'Upcoming {count}', past: 'Past {count}' },
  label: 'Upcoming tournaments',
  pastLabel: 'Past tournaments',
  empty: 'No tournaments to come.',
  pastEmpty: 'No past tournaments.',
  columns: { name: 'Tournament', starts: 'Starts', game: 'Game', interested: 'Interested', notified: 'Notified', entries: 'Entries' },
  /** Under Notified while the notification has not been sent. */
  notYet: 'Not yet',
  /** An empty cell: a past one never notified, entries not typed. */
  none: '–',
  /** The games a tournament is played as. */
  games: { nlh: 'No-Limit Hold’em', plo: 'Pot-Limit Omaha' },
  form: {
    name: 'Name',
    day: 'Day',
    time: 'Start time',
    timeHint: '24-hour, IST: 16:00',
    game: 'Game',
    create: 'Create',
    invalidName: 'Give it a name of up to 80 characters.',
    invalidDay: 'Give a day.',
    invalidTime: 'Give a time such as 16:00.',
    /** `Diwali Deepstack created` */
    created: '{name} created',
  },
  /** A tournament's record in the panel. */
  record: {
    status: 'Status',
    upcoming: 'Upcoming',
    past: 'Past',
    /** Above the members who asked. */
    asked: 'Asked to be notified',
    nobody: 'Nobody has asked yet.',
    /** A member who asked, and the day: `Mihir Shah · No. 1213`, `14 Nov`. */
    member: '{name} · No. {number}',
    /** The panel's one gold button, with how many asked: `Notify 61`. */
    notify: 'Notify {count}',
    /** The toast once sent: `58 notified: RIVR Sunday`. */
    notified: '{count} notified: {name}',
    cancel: 'Cancel tournament',
    cancelConfirm: 'Yes, cancel it',
    /** `Weeknight Turbo cancelled` */
    cancelled: '{name} cancelled',
    save: 'Save',
    entriesSaved: 'Entries saved',
    entriesMissing: 'Type the entries, 0 to 100,000.',
  },
  failures: {
    not_allowed: 'Not in your role. Ask an admin.',
    invalid: 'Not saved. Choose a start still to come.',
    paused: 'Venue frozen. Try again once it is released.',
    too_often: 'Members were told of this three times in the last hour. Try again later.',
    nobody: 'Nobody to notify. No one who asked has tournament notifications on.',
    unavailable: 'Not sent. Try again.',
  },
  /** Notify and Cancel refused: it has started, was cancelled or was notified already. */
  stale: 'Not sent. The list now shows why.',
};
