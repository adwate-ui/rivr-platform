/** Copy on the social posts and stories @rivr/render draws. Names, hands and amounts come with the card. */
export const social = {
  /** When something happens or happened: `Sunday 15 Nov 2026, 19:00`, in IST. */
  when: '{weekday} {date}, {time}',
  tournament: {
    label: 'Tournament',
    /** Beneath the guarantee figure. */
    guaranteed: 'Guaranteed',
    buyIn: 'Buy-in {amount}',
  },
  promotion: {
    label: 'Promotion',
  },
  winner: {
    label: 'Winner',
    /** What a jackpot's winner card says they won (#155). */
    badBeatJackpot: 'Bad-beat jackpot',
  },
  highHand: {
    label: 'High hand',
  },
} as const;
