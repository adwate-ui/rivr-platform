/**
 * TanStack Query keys of the main entry, one place for all of them. Keys that hold a person's data start with
 * their user id, so signing out and in as someone else never shows the previous person's data. A module that is
 * its own subpath (`@rivr/db/hostQueue` and the like) keeps its keys beside it, saying so, so they stay off the
 * player's first load, as this object cannot be trimmed. An invalidation of a family of keys names it by a prefix
 * helper here (`memberSearchAll`), never by a hand-written array (decision 0288).
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
  /** The club's numbers for calls and WhatsApp (decision 0582), the same for everyone. */
  clubContact: (userId: string) => ['user', userId, 'club-contact'] as const,
  /** Every feature's state for the signed-in member. */
  featureAccess: (userId: string) => ['user', userId, 'feature-access'] as const,
  /** The signed-in person's member rows, which the member app's live updates hear (#903). */
  myMemberIds: (userId: string) => ['user', userId, 'member-ids'] as const,
  /** The signed-in member's games, stake, notification choices and marketing consent. */
  preferences: (userId: string) => ['user', userId, 'preferences'] as const,
  /** The stakes the club runs, for Profile's waitlist alerts (#206). */
  stakes: (userId: string) => ['user', userId, 'stakes'] as const,
  restrictions: (userId: string) => ['user', userId, 'restrictions'] as const,
  /** The signed-in member's KYC record. */
  kycRecord: (userId: string) => ['user', userId, 'kyc-record'] as const,
  /** Whether the signed-in member's venue checks identity at the club. */
  kycAtTheClub: (userId: string) => ['user', userId, 'kyc-at-the-club'] as const,
  /** A venue's identity checks for a KYC reviewer. */
  kycReview: (userId: string, venueId: string) => ['user', userId, 'kyc-review', venueId] as const,
  /** Whether a venue checks identity at the club, as its KYC reviewers see it. */
  venueKycAtTheClub: (userId: string, venueId: string) => ['user', userId, 'kyc-review', venueId, 'at-the-club'] as const,
  /** Every search for a check in person at a venue, to refresh them together. */
  kycInPersonSearches: (userId: string, venueId: string) => ['user', userId, 'kyc-in-person', venueId] as const,
  kycInPersonCandidates: (userId: string, venueId: string, search: string) => ['user', userId, 'kyc-in-person', venueId, search] as const,
  kycDueTonight: (userId: string, venueId: string) => ['user', userId, 'kyc-due-tonight', venueId] as const,
  kycDeskClaims: (userId: string, venueId: string) => ['user', userId, 'kyc-desk-claims', venueId] as const,
  memberKycDocuments: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-kyc-documents', venueId, memberId] as const,
  kycAadhaarCovers: (userId: string, venueId: string) => ['user', userId, 'kyc-aadhaar-covers', venueId] as const,
  kycDuplicateHolder: (userId: string, memberId: string) => ['user', userId, 'kyc-duplicate-holder', memberId] as const,
  /** The venues where the signed-in person is active staff, with their role. */
  staffVenues: (userId: string) => ['user', userId, 'staff-venues'] as const,
  venueStaff: (userId: string, venueId: string) => ['user', userId, 'venue-staff', venueId] as const,
  /** A signed URL for one KYC image. */
  kycImageUrl: (userId: string, path: string) => ['user', userId, 'kyc-image-url', path] as const,
  /** Where the signed-in member's own face photo is kept (decision 0588). */
  myPhotoPath: (userId: string) => ['user', userId, 'my-photo-path'] as const,
  /** Tonight's tables and each game's waitlist length, as a member or staff sees them. */
  floorTables: (userId: string) => ['user', userId, 'floor-tables'] as const,
  floorTakenSeats: (userId: string) => ['user', userId, 'floor-taken-seats'] as const,
  myUsualFnbItems: (userId: string) => ['user', userId, 'my-usual-fnb-items'] as const,
  memberErasurePreview: (userId: string, memberId: string) => ['user', userId, 'member-erasure-preview', memberId] as const,
  memberErasureRequests: (userId: string, venueId: string) => ['user', userId, 'member-erasure-requests', venueId] as const,
  myErasureRequest: (userId: string) => ['user', userId, 'my-erasure-request'] as const,
  /** The signed-in member's waitlist places. */
  myWaitlist: (userId: string) => ['user', userId, 'my-waitlist'] as const,
  /** A venue's waitlists, as the floor sees them. */
  waitlistBoard: (userId: string, venueId: string) => ['user', userId, 'waitlist-board', venueId] as const,
  waitlistRequests: (userId: string, venueId: string) => ['user', userId, 'waitlist-requests', venueId] as const,
  floorSeats: (userId: string, venueId: string) => ['user', userId, 'floor-seats', venueId] as const,
  heldSeats: (userId: string, venueId: string) => ['user', userId, 'held-seats', venueId] as const,
  leftOwingCallTime: (userId: string, venueId: string) => ['user', userId, 'left-owing-call-time', venueId] as const,
  floorNight: (userId: string, venueId: string) => ['user', userId, 'floor-night', venueId] as const,
  floorRequests: (userId: string, venueId: string) => ['user', userId, 'floor-requests', venueId] as const,
  floorRequestTargets: (userId: string, venueId: string) => ['user', userId, 'floor-request-targets', venueId] as const,
  tableHands: (userId: string, tableId: string) => ['user', userId, 'table-hands', tableId] as const,
  tabletSeats: (userId: string) => ['user', userId, 'tablet-seats'] as const,
  mySeat: (userId: string) => ['user', userId, 'my-seat'] as const,
  myNextPlayTimeBonus: (userId: string) => ['user', userId, 'my-next-play-time-bonus'] as const,
  signedInPhone: (userId: string) => ['user', userId, 'signed-in-phone'] as const,
  doorBoard: (userId: string, venueId: string) => ['user', userId, 'door-board', venueId] as const,
  /** Reports › Players' visits over a span (decision 0682). */
  playerVisits: (userId: string, venueId: string) => ['user', userId, 'player-visits', venueId] as const,
  /** Each Bonus given in a report's span (#1063). */
  bonusGiven: (userId: string, venueId: string) => ['user', userId, 'bonus-given', venueId] as const,
  /** Bonus a promotion calculated, waiting for a super admin (decision 0670). */
  bonusWaiting: (userId: string, venueId: string) => ['user', userId, 'bonus-waiting', venueId] as const,
  contentBonusLine: (userId: string, venueId: string) => ['user', userId, 'content-bonus-line', venueId] as const,
  /** The member's visit to rate on Home, and the General Manager's list of feedback (decision 0165). */
  myFeedbackVisit: (userId: string) => ['user', userId, 'my-feedback-visit'] as const,
  venueFeedback: (userId: string, venueId: string) => ['user', userId, 'venue-feedback', venueId] as const,
  /** Under the prefix above, which a resolve refreshes: each list's count and a list's pages (F-024). */
  venueFeedbackOpen: (userId: string, venueId: string) => ['user', userId, 'venue-feedback', venueId, 'open'] as const,
  venueFeedbackCounts: (userId: string, venueId: string) => ['user', userId, 'venue-feedback', venueId, 'counts'] as const,
  venueFeedbackPage: (userId: string, venueId: string, list: string) => ['user', userId, 'venue-feedback', venueId, 'page', list] as const,
  /** Bonus chips (decision 0504): the member's own, or a member's for staff. Every key starts with bonusAll, which a live change makes stale. */
  bonusAll: (userId: string) => ['user', userId, 'bonus'] as const,
  myBonus: (userId: string) => ['user', userId, 'bonus', 'mine'] as const,
  myBonusHistory: (userId: string, count: number) => ['user', userId, 'bonus', 'mine', 'history', count] as const,
  memberBonus: (userId: string, venueId: string, memberId: string) => ['user', userId, 'bonus', venueId, memberId] as const,
  bonusByHandCap: (userId: string, venueId: string) => ['user', userId, 'bonus-by-hand-cap', venueId] as const,
  /** Every member's Bonus at a venue, which a Bonus file changes (the owner, 22 Nov), and the members a file names. */
  bonusAt: (userId: string, venueId: string) => ['user', userId, 'bonus', venueId] as const,
  bonusFileMembers: (userId: string, venueId: string, keys: string) => ['user', userId, 'bonus', venueId, 'file-members', keys] as const,
  /** What a member's visit may still redeem under bonus.visit_cap (decision 0579), under memberBonus so a seating refreshes both. */
  memberBonusVisitLeft: (userId: string, venueId: string, memberId: string) => ['user', userId, 'bonus', venueId, memberId, 'visit-left'] as const,
  /** The seats a super admin may add a missed Bonus use to (#1077), under memberBonus so a change refreshes them too. */
  bonusUseSeats: (userId: string, venueId: string, memberId: string, count: number) => ['user', userId, 'bonus', venueId, memberId, 'use-seats', count] as const,
  tableMetrics: (userId: string, venueId: string, from: string, to: string) => ['user', userId, 'table-metrics', venueId, from, to] as const,
  tableMetricsTotal: (userId: string, venueId: string, from: string, to: string) => ['user', userId, 'table-metrics-total', venueId, from, to] as const,
  /** One read of a report over a span (redesign RD-27): `name` is its chart, its figures or its lines. */
  clubReport: (userId: string, name: string, span: { venueId: string; from: string; to: string }) => ['user', userId, 'club-report', span.venueId, name, span.from, span.to] as const,
  /** Every report of a venue, each span: what a visit's correction changes (#1075). */
  clubReportsAt: (userId: string, venueId: string) => ['user', userId, 'club-report', venueId] as const,
  memberSignUp: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-sign-up', venueId, memberId] as const,
  /** The members whose account is not simply active (F-121). */
  memberAccountStatuses: (userId: string, venueId: string) => ['user', userId, 'member-account-statuses', venueId] as const,
  /** A member's visits on their record (F-017). */
  memberVisits: (userId: string, venueId: string, memberId: string, count: number) => ['user', userId, 'member-visits', venueId, memberId, count] as const,
  memberHoursPlayed: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-hours', venueId, memberId] as const,
  /** A member's changes by staff, their History from the Members table (the owner, 19 Nov). */
  memberStaffHistory: (userId: string, venueId: string, memberId: string, count: number) => ['user', userId, 'member-staff-history', venueId, memberId, count] as const,
  memberVisitsAll: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-visits', venueId, memberId] as const,
  memberBonusHistory: (userId: string, venueId: string, memberId: string, count: number) =>
    ['user', userId, 'bonus', venueId, memberId, 'history', count] as const,
  /** Table-side food and drink (#123): the member's menu, a venue's, its items, and tonight's orders. */
  myFnbMenu: (userId: string) => ['user', userId, 'my-fnb-menu'] as const,
  /** The signed-in member's orders tonight, and where each is (#635). */
  myFnbOrders: (userId: string) => ['user', userId, 'my-fnb-orders'] as const,
  fnbMenu: (userId: string, venueId: string) => ['user', userId, 'fnb-menu', venueId] as const,
  /** Whether a venue takes food and drink orders now (decision 0681); 'mine' for the member's own venue. */
  fnbOn: (userId: string, venueId: string) => ['user', userId, 'fnb-on', venueId] as const,
  fnbOnAll: (userId: string) => ['user', userId, 'fnb-on'] as const,
  fnbItems: (userId: string, venueId: string) => ['user', userId, 'fnb-items', venueId] as const,
  fnbOrdersTonight: (userId: string, venueId: string) => ['user', userId, 'fnb-orders-tonight', venueId] as const,
  topUpsTonight: (userId: string, venueId: string) => ['user', userId, 'top-ups-tonight', venueId] as const,
  /** A club day's top-up requests, a page at a time (redesign RD-32); every page starts with topUpHistoryAll, which a step taken makes stale. */
  topUpHistoryAll: (userId: string, venueId: string) => ['user', userId, 'top-up-history', venueId] as const,
  topUpHistory: (userId: string, venueId: string, day: string, page: number) => ['user', userId, 'top-up-history', venueId, day, page] as const,
  staffQueueCounts: (userId: string, venueId: string) => ['user', userId, 'staff-queue-counts', venueId] as const,
  /** The signed-in staff member's console density at a venue (decision 0475). */
  staffDensity: (userId: string, venueId: string) => ['user', userId, 'staff-density', venueId] as const,
  staffShortcuts: (userId: string, venueId: string) => ['user', userId, 'staff-shortcuts', venueId] as const,
  todaysPlayers: (userId: string, venueId: string) => ['user', userId, 'todays-players', venueId] as const,
  /** A venue's stakes and tables, for Tables setup (#642). */
  tablesSetup: (userId: string, venueId: string) => ['user', userId, 'tables-setup', venueId] as const,
  /** The member's referral code (#151). */
  myReferral: (userId: string) => ['user', userId, 'my-referral'] as const,
  /** The TV's hours leaderboard (decision 0581). */
  tvLeaderboard: (userId: string) => ['user', userId, 'tv-leaderboard'] as const,
  /** A venue's games not running and their interest (#113), and its hands over a period (#114). */
  interestLists: (userId: string, venueId: string) => ['user', userId, 'interest-lists', venueId] as const,
  activityLog: (userId: string, venueId: string, filters: object) => ['user', userId, 'activity-log', venueId, filters] as const,
  memberSearch: (userId: string, venueId: string, query: string) => ['user', userId, 'member-search', venueId, query] as const,
  /** Every memberSearch key: the prefix an invalidation of them all names. */
  memberSearchAll: (userId: string) => ['user', userId, 'member-search'] as const,
  /** A page of the Members list by its view, and a column menu's counts for it (redesign RD-29). */
  membersList: (userId: string, venueId: string, view: unknown) => ['user', userId, 'members-list', 'page', venueId, view] as const,
  memberChoices: (userId: string, venueId: string, view: unknown) => ['user', userId, 'members-list', 'choices', venueId, view] as const,
  /** Every membersList and memberChoices key: the prefix an invalidation of them all names. */
  membersListAll: (userId: string) => ['user', userId, 'members-list'] as const,
  memberRecord: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-record', venueId, memberId] as const,
  memberEarlyDepartures: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-early-departures', venueId, memberId] as const,
  venueTiers: (userId: string, venueId: string) => ['user', userId, 'venue-tiers', venueId] as const,
  memberFeatureOverrides: (userId: string, venueId: string, memberId: string) => ['user', userId, 'member-feature-overrides', venueId, memberId] as const,
  gateableFeatures: (userId: string) => ['user', userId, 'gateable-features'] as const,
  /** The signed-in dealer tablet and its table. */
  myDevice: (userId: string) => ['user', userId, 'my-device'] as const,
  /** A venue's dealer tablets, for staff who manage devices. */
  dealerTablets: (userId: string, venueId: string) => ['user', userId, 'dealer-tablets', venueId] as const,
  /** A venue's dealers whose PIN the signed-in manager may set. */
  venueDealers: (userId: string, venueId: string) => ['user', userId, 'venue-dealers', venueId] as const,
  /** The dealers who can sign in on this tablet. */
  tabletDealers: (userId: string) => ['user', userId, 'tablet-dealers'] as const,
  /** The down at this tablet's table. */
  currentDown: (userId: string, tableId: string) => ['user', userId, 'current-down', tableId] as const,
  /** Every currentDown key: the prefix an invalidation of them all names. */
  currentDownAll: (userId: string) => ['user', userId, 'current-down'] as const,
  /** The tablet's table rules now: rake, drop, variations; kept by table. */
  tableRules: (userId: string, tableId: string) => ['user', userId, 'table-rules', tableId] as const,
  /** An unpaired TV's code (#49): signed out, so it belongs to no one. */
  tvCode: () => ['tv-code'] as const,
  /** Whether staff have typed in that code yet. */
  tvClaim: (code: string) => ['tv-code', code, 'claim'] as const,
  /** The signed-in TV's name and mode. */
  myTvScreen: (userId: string) => ['user', userId, 'my-tv-screen'] as const,
  tvReportIn: (userId: string) => ['user', userId, 'tv-report-in'] as const,
  /** A venue's TVs, for staff who manage devices. */
  venueTvs: (userId: string, venueId: string) => ['user', userId, 'venue-tvs', venueId] as const,
  tvPairingPolicy: (userId: string, venueId: string) => ['user', userId, 'tv-pairing-policy', venueId] as const,
  /** A venue's stakes for the promotion builder (#84). */
  promotionStakes: (userId: string, venueId: string) => ['user', userId, 'promotion-stakes', venueId] as const,
  /** The console's promotions list, a promotion's versions and a member's grants (console v3 phase 7). */
  promotionsOverview: (userId: string, venueId: string) => ['user', userId, 'promotions-overview', venueId] as const,
  promotionVersions: (userId: string, promotionId: string) => ['user', userId, 'promotion-versions', promotionId] as const,
  /** Tonight's high hands at a venue, or one promotion's of them (redesign RD-23); a payout makes them all stale (`highHandTonights`). */
  highHandTonights: (userId: string, venueId: string) => ['user', userId, 'high-hand-tonight', venueId] as const,
  highHandTonight: (userId: string, venueId: string, promotionId: string | null = null) =>
    ['user', userId, 'high-hand-tonight', venueId, promotionId ?? 'all'] as const,
  /** The high hand that runs at a venue now, for the Live floor (redesign RD-24). */
  highHandLive: (userId: string, venueId: string) => ['user', userId, 'high-hand-live', venueId] as const,
  /** The high hand among the signed-in member's offers, and the signed-in TV's High hand bonus board (redesign RD-25). */
  myHighHand: (userId: string) => ['user', userId, 'my-high-hand'] as const,
  tvHighHand: (userId: string) => ['user', userId, 'tv-high-hand'] as const,
  /** Last week replayed afresh on a waiting version, for its approver (decision 0495). */
  promotionReplay: (userId: string, versionId: string) => ['user', userId, 'promotion-replay', versionId] as const,
  memberPromotionGrants: (userId: string, memberId: string, count: number) => ['user', userId, 'member-promotion-grants', memberId, count] as const,
  /** Each active hire's onboarding checklist at a venue (#107), for staff who manage staff. */
  onboardingChecklists: (userId: string, venueId: string) => ['user', userId, 'onboarding-checklists', venueId] as const,
  /** The signed-in TV's waitlist board (#65). */
  tvWaitlistBoard: (userId: string) => ['user', userId, 'tv-waitlist-board'] as const,
  /** The club's notice along the foot of the signed-in TV's boards (redesign RD-28). */
  tvNotice: (userId: string) => ['user', userId, 'tv-notice'] as const,
  /** The signed-in TV's call-time board (decision 0163). */
  tvCallTimeBoard: (userId: string) => ['user', userId, 'tv-call-time-board'] as const,
  /** The paired TV's promotions rotation (#86), and the member's Home cards. */
  tvPromotions: (userId: string) => ['user', userId, 'tv-promotions'] as const,
  myPromotionCards: (userId: string) => ['user', userId, 'my-promotion-cards'] as const,
  /** The member's venue's upcoming tournaments and whether they asked about each (#636); the venue's tournaments as staff see them, and who asked about one. */
  myUpcomingTournaments: (userId: string) => ['user', userId, 'my-upcoming-tournaments'] as const,
  venueTournaments: (userId: string, venueId: string) => ['user', userId, 'venue-tournaments', venueId] as const,
  tournamentInterested: (userId: string, tournamentId: string) => ['user', userId, 'tournament-interested', tournamentId] as const,
};
