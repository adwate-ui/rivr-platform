/** The public website's own copy; its pages' words are the club's site content. */
export const webApp = {
  /** A website page when its content cannot be read. */
  unavailableTitle: 'The website is not available',
  unavailable: 'Try again in a few minutes.',
  /** The header's one action: into the player app, where a member joins a waitlist (#441). */
  reserve: 'Reserve a seat',
  /** A promotions block while none runs (decision 0166). */
  noPromotions: 'No promotions are running just now. Check back soon.',
  /** The footer on every page (#441): where the club is, how to reach it, and its 18+ line. */
  footer: {
    address: 'Upper floor, Glaza, M3M 65th Avenue, Gurugram',
    notice: 'Strictly 18+. Poker is a game of skill.',
    instagram: '@rivr.pokerclub',
    /** The club's policy pages, linked from every page's footer (decision 0166). */
    houseRules: 'House rules',
    questions: 'Questions',
    responsiblePlay: 'Responsible play',
    privacy: 'Privacy',
    terms: 'Terms of use',
    email: 'info@rivrpoker.com',
  },
} as const;
