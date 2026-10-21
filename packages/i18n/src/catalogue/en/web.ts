/** The public website's own copy; its pages' words are the club's site content. */
export const webApp = {
  /** A website page when its content cannot be read. */
  unavailableTitle: 'The website is not available',
  unavailable: 'Try again in a few minutes.',
  /** The header's one action: into the player app, where a member joins a waitlist (#441). */
  reserve: 'Reserve a seat',
  /** The footer on every page (#441): where the club is, how to reach it, and its 18+ line. */
  footer: {
    address: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram',
    notice: 'Strictly 18+. Poker is a game of skill.',
    instagram: '@rivr.pokerclub',
    email: 'info@rivrpoker.com',
  },
} as const;
