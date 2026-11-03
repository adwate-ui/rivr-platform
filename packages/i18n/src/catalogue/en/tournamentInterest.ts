/** The floor's Tournament interest screen (#636): who registered interest in each upcoming tournament from the app. */
export const tournamentInterest = {
  title: 'Tournament interest',
  empty: 'No one has registered interest in an upcoming tournament.',
  /** A tournament and when it starts: `RIVR Sunday · Sun 15 Nov, 16:00`. */
  tournament: '{name} · {when}',
  /** A member who asked: `Mihir Shah · No. 1213`. */
  member: '{name} · No. {number}',
  mark: 'Mark registered',
  markName: 'Mark {name} registered',
  registered: 'Registered',
  failures: {
    not_allowed: 'Your role does not register players. The floor does.',
    invalid: 'Registered already. The list now shows it.',
    paused: 'The venue is frozen. Registration resumes once it is released.',
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
