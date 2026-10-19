/** Copy on the TV screens and the slides @rivr/render draws for them. */
export const tv = {
  badBeatJackpot: {
    /** Letter-spaced label above the jackpot figure. */
    title: 'Bad-beat jackpot',
  },
  /** The display modes (additions "TV modes"), as the console offers them and a TV names its own (#49). */
  modes: {
    waitlist: 'Waitlist board',
    call_time: 'Call-time board',
    jackpot: 'Jackpot and high hand',
    tournament_clock: 'Tournament clock',
    promotions: 'Promotions',
    rewards: 'Rewards ticker',
    league: 'League leaderboard',
    social_wall: 'Social wall',
    spin_wheel: 'Spin wheel',
  },
} as const;
