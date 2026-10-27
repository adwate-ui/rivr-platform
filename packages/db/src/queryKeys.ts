/**
 * TanStack Query keys, one place for all of them. Keys that hold a person's data start with
 * their user id, so signing out and in as someone else never shows the previous person's data.
 */
export const queryKeys = {
  /** The start of every key below: everything cached for the signed-in person. */
  personal: ['user'] as const,
  /** The signed-in member's name and initial. */
  member: (userId: string) => ['user', userId, 'member'] as const,
  /** Every setting key with its values at a venue, for the Settings screen (#33). */
  venueSettings: (userId: string, venueId: string) => ['user', userId, 'venue-settings', venueId] as const,
  /** A venue's configuration, for a super admin (#33). */
  venueConfig: (userId: string, venueId: string) => ['user', userId, 'venue-config', venueId] as const,
  /** A venue's chip denominations (#33). */
  chipDenominations: (userId: string, venueId: string) => ['user', userId, 'chip-denominations', venueId] as const,
  /** The signed-in member's membership card and its door code for now (#71). */
  membershipCard: (userId: string) => ['user', userId, 'membership-card'] as const,
  /** Every feature's state for the signed-in member. */
  featureAccess: (userId: string) => ['user', userId, 'feature-access'] as const,
  /** Kill-switch controls the signed-in person can see. */
  controlState: (userId: string) => ['user', userId, 'control-state'] as const,
  /** The signed-in member's games, stake, notification choices and marketing consent. */
  preferences: (userId: string) => ['user', userId, 'preferences'] as const,
  /** The stakes the club runs, for Profile's waitlist alerts (#206). */
  stakes: (userId: string) => ['user', userId, 'stakes'] as const,
  restrictions: (userId: string) => ['user', userId, 'restrictions'] as const,
  /** The signed-in member's Balance (#18), and their newest movements. */
  wallet: (userId: string) => ['user', userId, 'wallet'] as const,
  walletMovements: (userId: string, count: number) => ['user', userId, 'wallet', 'movements', count] as const,
  /** The signed-in member's payout accounts (#19), and the venue's waiting for the cage. */
  payoutAccounts: (userId: string) => ['user', userId, 'payout-accounts'] as const,
  payoutAccountsToVerify: (userId: string, venueId: string) => ['user', userId, 'payout-accounts-to-verify', venueId] as const,
  /** The signed-in member's withdrawals (#21), and the venue's waiting for the cage. */
  withdrawals: (userId: string) => ['user', userId, 'withdrawals'] as const,
  waitingWithdrawals: (userId: string, venueId: string) => ['user', userId, 'waiting-withdrawals', venueId] as const,
  /** The signed-in member's deposits and where to pay them (#29), and the venue's waiting for the cage. */
  deposits: (userId: string) => ['user', userId, 'deposits'] as const,
  depositDetails: (userId: string) => ['user', userId, 'deposits', 'details'] as const,
  waitingDeposits: (userId: string, venueId: string) => ['user', userId, 'waiting-deposits', venueId] as const,
  /** The venue's Treasury and the cage's chip count (#24): refreshed together after a shift opens or a count. */
  treasury: (userId: string, venueId: string) => ['user', userId, 'treasury', venueId] as const,
  /** The venue's end-of-day closes (#45). */
  eodCloses: (userId: string, venueId: string) => ['user', userId, 'eod-closes', venueId] as const,
  /** A venue's shift openings that differed from the last close (#376). */
  shiftOpenings: (userId: string, venueId: string) => ['user', userId, 'shift-openings', venueId] as const,
  /** Everything Academy for the signed-in member: refreshed together after a booking or a payment. */
  academy: (userId: string) => ['user', userId, 'academy'] as const,
  academyBatches: (userId: string) => ['user', userId, 'academy', 'batches'] as const,
  academyBookings: (userId: string) => ['user', userId, 'academy', 'bookings'] as const,
  academyPayment: (userId: string, bookingId: string) => ['user', userId, 'academy', 'payment', bookingId] as const,
  academyInvoice: (userId: string, bookingId: string) => ['user', userId, 'academy', 'invoice', bookingId] as const,
  /** The signed-in member's KYC record. */
  kycRecord: (userId: string) => ['user', userId, 'kyc-record'] as const,
  /** A venue's Academy batches and bookings, as staff see them. */
  academyStaff: (userId: string, venueId: string) => ['user', userId, 'academy-staff', venueId] as const,
  /** A venue's identity checks for a KYC reviewer. */
  kycReview: (userId: string, venueId: string) => ['user', userId, 'kyc-review', venueId] as const,
  /** Every search for a check in person at a venue, to refresh them together. */
  kycInPersonSearches: (userId: string, venueId: string) => ['user', userId, 'kyc-in-person', venueId] as const,
  kycInPersonCandidates: (userId: string, venueId: string, search: string) => ['user', userId, 'kyc-in-person', venueId, search] as const,
  /** The venues where the signed-in person is active staff, with their role. */
  staffVenues: (userId: string) => ['user', userId, 'staff-venues'] as const,
  venueStaff: (userId: string, venueId: string) => ['user', userId, 'venue-staff', venueId] as const,
  tierMatrix: (userId: string, venueId: string) => ['user', userId, 'tier-matrix', venueId] as const,
  /** A signed URL for one KYC image. */
  kycImageUrl: (userId: string, path: string) => ['user', userId, 'kyc-image-url', path] as const,
  /** Tonight's tables and each game's waitlist length, as a member or staff sees them. */
  floorTables: (userId: string) => ['user', userId, 'floor-tables'] as const,
  myTonight: (userId: string) => ['user', userId, 'my-tonight'] as const,
  practiceResetPreview: (userId: string, venueId: string) => ['user', userId, 'practice-reset-preview', venueId] as const,
  memberErasurePreview: (userId: string, memberId: string) => ['user', userId, 'member-erasure-preview', memberId] as const,
  /** The signed-in member's waitlist places. */
  myWaitlist: (userId: string) => ['user', userId, 'my-waitlist'] as const,
  /** A venue's waitlists, as the floor sees them. */
  waitlistBoard: (userId: string, venueId: string) => ['user', userId, 'waitlist-board', venueId] as const,
  floorSeats: (userId: string, venueId: string) => ['user', userId, 'floor-seats', venueId] as const,
  heldSeats: (userId: string, venueId: string) => ['user', userId, 'held-seats', venueId] as const,
  leftOwingCallTime: (userId: string, venueId: string) => ['user', userId, 'left-owing-call-time', venueId] as const,
  floorNight: (userId: string, venueId: string) => ['user', userId, 'floor-night', venueId] as const,
  tableHands: (userId: string, tableId: string) => ['user', userId, 'table-hands', tableId] as const,
  tabletSeats: (userId: string) => ['user', userId, 'tablet-seats'] as const,
  mySeat: (userId: string) => ['user', userId, 'my-seat'] as const,
  cageMembers: (userId: string, venueId: string, query: string) => ['user', userId, 'cage-members', venueId, query] as const,
  cageQueue: (userId: string, venueId: string) => ['user', userId, 'cage-queue', venueId] as const,
  creditLines: (userId: string, venueId: string) => ['user', userId, 'credit-lines', venueId] as const,
  creditRoom: (userId: string, venueId: string) => ['user', userId, 'credit-room', venueId] as const,
  openMarkers: (userId: string, venueId: string) => ['user', userId, 'open-markers', venueId] as const,
  /** The credit report at a moment ('now' for the present), the payment accounts, a statement, and expenses (#92, #94, #95). */
  creditReport: (userId: string, venueId: string, at: string) => ['user', userId, 'credit-report', venueId, at] as const,
  paymentAccounts: (userId: string, venueId: string) => ['user', userId, 'payment-accounts', venueId] as const,
  accountStatement: (userId: string, accountId: string, from: string, to: string) => ['user', userId, 'account-statement', accountId, from, to] as const,
  expenseCategories: (userId: string, venueId: string) => ['user', userId, 'expense-categories', venueId] as const,
  venueExpenses: (userId: string, venueId: string) => ['user', userId, 'venue-expenses', venueId] as const,
  receiptUrl: (userId: string, path: string) => ['user', userId, 'receipt-url', path] as const,
  doorBoard: (userId: string, venueId: string) => ['user', userId, 'door-board', venueId] as const,
  /** The member's visit to rate on Home, and the General Manager's list of feedback (decision 0165). */
  myFeedbackVisit: (userId: string) => ['user', userId, 'my-feedback-visit'] as const,
  venueFeedback: (userId: string, venueId: string) => ['user', userId, 'venue-feedback', venueId] as const,
  /** The suspicious-activity register (#105). */
  amlRegister: (userId: string, venueId: string) => ['user', userId, 'aml-register', venueId] as const,
  /** A venue's rewards catalogue and redemptions, as the console keeps them (decision 0181). */
  rewardItems: (userId: string, venueId: string) => ['user', userId, 'reward-items', venueId] as const,
  venueRedemptions: (userId: string, venueId: string) => ['user', userId, 'venue-redemptions', venueId] as const,
  /** A venue's League seasons, and its standings over some months (decision 0182). */
  leagueSeasons: (userId: string, venueId: string) => ['user', userId, 'league-seasons', venueId] as const,
  venueLeague: (userId: string, venueId: string, first: string, last: string) => ['user', userId, 'venue-league', venueId, first, last] as const,
  /** The member's Rewards tab (#152): points and tier, the catalogue, their redemptions and the League. */
  myRewards: (userId: string) => ['user', userId, 'my-rewards'] as const,
  rewardCatalogue: (userId: string) => ['user', userId, 'reward-catalogue'] as const,
  myRedemptions: (userId: string) => ['user', userId, 'my-redemptions'] as const,
  myLeague: (userId: string) => ['user', userId, 'my-league'] as const,
  /** The TV's rewards ticker and League leaderboard (#148, decision 0183). */
  tvRewardsTicker: (userId: string) => ['user', userId, 'tv-rewards-ticker'] as const,
  tvLeagueBoard: (userId: string) => ['user', userId, 'tv-league-board'] as const,
  /** A venue's games not running and their interest (#113), and its hands over a period (#114). */
  interestLists: (userId: string, venueId: string) => ['user', userId, 'interest-lists', venueId] as const,
  potData: (userId: string, venueId: string, start: string, end: string) => ['user', userId, 'pot-data', venueId, start, end] as const,
  engagedControls: (userId: string, venueId: string) => ['user', userId, 'engaged-controls', venueId] as const,
  memberSearch: (userId: string, venueId: string, query: string) => ['user', userId, 'member-search', venueId, query] as const,
  membersOfTier: (userId: string, venueId: string, tierId: string) => ['user', userId, 'members-of-tier', venueId, tierId] as const,
  memberRecord: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-record', venueId, memberId] as const,
  memberEarlyDepartures: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-early-departures', venueId, memberId] as const,
  venueTiers: (userId: string, venueId: string) => ['user', userId, 'venue-tiers', venueId] as const,
  memberFeatureOverrides: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-feature-overrides', venueId, memberId] as const,
  gateableFeatures: (userId: string) => ['user', userId, 'gateable-features'] as const,
  /** The signed-in dealer tablet and its table. */
  myDevice: (userId: string) => ['user', userId, 'my-device'] as const,
  /** A venue's dealer tablets, for staff who manage devices. */
  dealerTablets: (userId: string, venueId: string) => ['user', userId, 'dealer-tablets', venueId] as const,
  venueIssuer: (userId: string, venueId: string) => ['user', userId, 'venue-issuer', venueId] as const,
  computers: (userId: string, venueId: string) => ['user', userId, 'computers', venueId] as const,
  thisComputer: (userId: string, venueId: string) => ['user', userId, 'this-computer', venueId] as const,
  contacts: (userId: string, venueId: string) => ['user', userId, 'contacts', venueId] as const,
  incidents: (userId: string, venueId: string) => ['user', userId, 'incidents', venueId] as const,
  drills: (userId: string, venueId: string) => ['user', userId, 'drills', venueId] as const,
  /** A venue's dealers whose PIN the signed-in manager may set. */
  venueDealers: (userId: string, venueId: string) => ['user', userId, 'venue-dealers', venueId] as const,
  /** A venue's table types with their rake now and the changes to come. */
  tableTypeRake: (userId: string, venueId: string) => ['user', userId, 'table-type-rake', venueId] as const,
  /** A venue's jackpot: pools, payout rule and history. */
  jackpot: (userId: string, venueId: string) => ['user', userId, 'jackpot', venueId] as const,
  /** The dealers who can sign in on this tablet. */
  tabletDealers: (userId: string) => ['user', userId, 'tablet-dealers'] as const,
  /** The down at this tablet's table. */
  currentDown: (userId: string, tableId: string) => ['user', userId, 'current-down', tableId] as const,
  /** The tablet's table rules now: rake, drop, variations; kept by table. */
  tableRules: (userId: string, tableId: string) => ['user', userId, 'table-rules', tableId] as const,
  /** The hands of the open down on the tablet, kept by down. */
  downHands: (userId: string, downId: string) => ['user', userId, 'down-hands', downId] as const,
  /** An unpaired TV's code (#49): signed out, so it belongs to no one. */
  tvCode: () => ['tv-code'] as const,
  /** Whether staff have typed in that code yet. */
  tvClaim: (code: string) => ['tv-code', code, 'claim'] as const,
  /** The signed-in TV's name and mode. */
  myTvScreen: (userId: string) => ['user', userId, 'my-tv-screen'] as const,
  /** A venue's TVs, for staff who manage devices. */
  venueTvs: (userId: string, venueId: string) => ['user', userId, 'venue-tvs', venueId] as const,
  /** The tablet's own high-hand claims. */
  tabletHighHands: (userId: string) => ['user', userId, 'tablet-high-hands'] as const,
  /** A venue's high hands, for the console. */
  highHands: (userId: string, venueId: string) => ['user', userId, 'high-hands', venueId] as const,
  /** A venue's certification quizzes, and the attempts at them the signed-in staff member may see (#50): all, or one person's, under it. */
  quizzes: (userId: string, venueId: string) => ['user', userId, 'quizzes', venueId] as const,
  quizAttempts: (userId: string, venueId: string) => ['user', userId, 'quiz-attempts', venueId] as const,
  /** A venue's live and paused promotions, and its stakes for the builder (#84). */
  promotions: (userId: string, venueId: string) => ['user', userId, 'promotions', venueId] as const,
  promotionStakes: (userId: string, venueId: string) => ['user', userId, 'promotion-stakes', venueId] as const,
  promotionTemplates: (userId: string, venueId: string) => ['user', userId, 'promotion-templates', venueId] as const,
  /** A venue's promotions waiting for a super admin (#144). */
  promotionsAwaitingApproval: (userId: string, venueId: string) => ['user', userId, 'promotions-awaiting', venueId] as const,
  /** A venue's SOP library (#51), and who has acknowledged each version, for SOP managers. */
  sops: (userId: string, venueId: string) => ['user', userId, 'sops', venueId] as const,
  sopAcknowledgementsAll: (userId: string) => ['user', userId, 'sop-acknowledgements'] as const,
  sopAcknowledgements: (userId: string, versionId: string) => ['user', userId, 'sop-acknowledgements', versionId] as const,
  /** Each active hire's onboarding checklist at a venue (#107), for staff who manage staff. */
  onboardingChecklists: (userId: string, venueId: string) => ['user', userId, 'onboarding-checklists', venueId] as const,
  /** The signed-in TV's waitlist board (#65). */
  tvWaitlistBoard: (userId: string) => ['user', userId, 'tv-waitlist-board'] as const,
  /** The signed-in TV's call-time board (decision 0163). */
  tvCallTimeBoard: (userId: string) => ['user', userId, 'tv-call-time-board'] as const,
  /** The signed-in TV's jackpot and tonight's high hand (#65). */
  tvJackpot: (userId: string) => ['user', userId, 'tv-jackpot'] as const,
  /** The paired TV's promotions rotation (#86), and the member's Home cards. */
  tvPromotions: (userId: string) => ['user', userId, 'tv-promotions'] as const,
  myPromotionCards: (userId: string) => ['user', userId, 'my-promotion-cards'] as const,
  /** The console's tournaments, blind structures and templates at a venue (#115, #119). */
  venueTournaments: (userId: string, venueId: string) => ['user', userId, 'venue-tournaments', venueId] as const,
  blindStructures: (userId: string, venueId: string) => ['user', userId, 'blind-structures', venueId] as const,
  tournamentTemplates: (userId: string, venueId: string) => ['user', userId, 'tournament-templates', venueId] as const,
  /** Home's tournament for the member (#118, #119). */
  myTournament: (userId: string) => ['user', userId, 'my-tournament'] as const,
  /** A tournament's players and the floor's balancing prompts (#120). */
  tournamentSeating: (userId: string, tournamentId: string) => ['user', userId, 'tournament-seating', tournamentId] as const,
  tournamentBalance: (userId: string, tournamentId: string) => ['user', userId, 'tournament-balance', tournamentId] as const,
  /** What a tournament paid: prizes and bounties (#117, #121). */
  tournamentPayouts: (userId: string, tournamentId: string) => ['user', userId, 'tournament-payouts', tournamentId] as const,
  /** The paired TV's tournament clock (#119). */
  tvTournamentClock: (userId: string) => ['user', userId, 'tv-tournament-clock'] as const,
};
