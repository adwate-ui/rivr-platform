/** The floor's Tournament interest screen (#636): who registered interest in each upcoming tournament from the app. */
export const tournamentInterest = {
  title: 'Tournament interest',
  empty: 'No tournament is published.',
  /** On a published tournament's card (F-027): `{name}` is the tournament. */
  edit: 'Edit',
  editName: 'Edit {name}',
  save: 'Save changes',
  cancelEdit: 'Cancel',
  withdraw: 'Withdraw',
  withdrawName: 'Withdraw {name}',
  withdrawConfirm: 'Yes, withdraw it',
  /** On a card once withdrawn: members no longer see it. */
  withdrawn: 'Withdrawn',
  publishAgain: 'Publish again',
  publishAgainName: 'Publish {name} again',
  /** A tournament and when it starts: `RIVR Sunday · Sun 15 Nov, 16:00`. */
  tournament: '{name} · {when}',
  /** A member who asked: `Mihir Shah · No. 1213`. */
  member: '{name} · No. {number}',
  mark: 'Mark registered',
  markName: 'Mark {name} registered',
  registered: 'Registered',
  /** A tournament's card (console v3): how many asked, and how many of them are registered. */
  counts: '{interested} interested · {registered} registered',
  /** The toast after Mark registered, with Undo for a mistake (console v3). */
  marked: '{name} marked registered',
  /** Undo refused: marked more than ten minutes ago, or by another step first. */
  undoFailed: 'Not taken back. The list now shows it.',
  failures: {
    not_allowed: 'Your role does not register players. The floor does.',
    invalid: 'Not marked. The list now shows why.',
    paused: 'Venue frozen. Try again once it is released.',
    unavailable: 'That did not go through. Check the connection and try again.',
  },
  /** A tournament published without money (#800; decision 0441): members see it in the app at once. */
  publish: {
    heading: 'New tournament',
    name: 'Name',
    day: 'Day',
    time: 'Start time',
    timeHint: '24-hour, IST: 16:00',
    game: 'Game',
    stake: 'Stake',
    description: 'Description',
    publish: 'Publish',
    /** `Diwali Deepstack published.` */
    published: '{name} published.',
    invalidName: 'Give it a name of up to 80 characters.',
    invalidDay: 'Give a day.',
    invalidTime: 'Give a time such as 16:00.',
    invalidGame: 'Give the game, up to 40 characters.',
    invalidStake: 'Give the stake, up to 40 characters.',
    invalidDescription: 'Keep it to 500 characters.',
    failures: {
      not_allowed: 'Not in your role. Ask an admin.',
      invalid: 'Not published. Choose a start still to come.',
      paused: 'Venue frozen. Try again once it is released.',
      unavailable: 'Not sent. Try again.',
    },
  },
};
