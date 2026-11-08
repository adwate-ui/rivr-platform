/**
 * What the owner's alert message says each kind of alert is (#100): words only, never an alert's
 * details, so an alert carries no personal data. The details are in the console.
 */
export const alerts = {
  kinds: {
    'auth.sms_rate_limit': 'sign-in codes are being refused because the hourly limit is used up',
    'cage.rate_limit': 'a cashier, or the venue, reached the limit of cage money calls in a minute',
    'aml.settings_changed': 'a super admin changed the AML settings',
    'aml.structuring': 'a member\'s cash buy-ins ended just under the limit several times: the AML register has an entry to review',
    'control.engaged': 'the kill switch was engaged',
    'control.release_asked': 'a release of the kill switch was asked for',
    'control.released': 'the kill switch was released',
    'purge.asked': 'a purge of the venue was asked for',
    'dealer.uncounted': 'a dealer down closed without its count',
    'dealer.variance': 'a dealer down closed with a variance',
    'devices.pairing_guessed': 'someone kept guessing a device pairing code',
    'feedback.low_rating': 'a member rated their visit one or two out of five',
    'points.daily_cap': 'a staff member tried to give points past their daily limit',
    'kyc.recheck_failed': 'a member\'s in-person check failed its PAN recheck',
    'eod.opening_variance': 'a cage shift opened with a variance',
    'eod.variance': 'a cage shift closed with a variance',
    'export.large': 'a large export was taken: a table, or an archive',
    'exports.key_changed': 'the export archive\'s key was changed',
    'invoice.rake_negative': 'a night’s rake and tournament fees came to less than nothing',
    'invoice.rake_refused': 'a night’s rake invoice could not be issued',
    'member.break_while_seated': 'a member started a break while seated',
    'member.phone_changed': 'a super admin changed a member\'s phone number, which is their login',
    'mis.not_stored': 'the monthly MIS could not be stored',
    'outbox.delivery_failed': 'a message or post could not be delivered',
    'outbox.failures': 'many messages or posts are failing',
    /** A consumer that stopped claiming (A5-12): its Edge Function is down, or the scheduler's Vault secrets are missing. */
    'outbox.silent': 'messages, posts or syncs have stopped going out: one of the club\'s senders is not running',
    'tournaments.ticket_refund_failed': 'a lapsed tournament ticket could not be refunded to its member',
    'rakeback.refused': 'a week\'s rakeback could not be given',
    'rakeback.unpaid': 'a week\'s rakeback held by a freeze or the kill switch for over five weeks was not given',
    'staff.role_granted': 'a staff member was given a role that moves money, approves a second time, stops the venue or runs promotions, or such a row was given another number',
    'venue.purged': 'the venue\'s data was purged',
    'venue.config_changed': 'a super admin changed the venue’s networks, payment details or alert number',
    'settings.control_changed': 'a super admin changed a control setting: credit, second approval, TDS, alert thresholds, GST, high-hand or jackpot payouts, or rakeback',
    'website.publish_failed': 'a website page scheduled to publish could not be published: its draft is waiting in the console',
    'withdrawal.payout_orphaned': 'Cashfree paid a withdrawal the cage had already paid another way or given up on',
    'withdrawal.payout_stuck': 'a Cashfree payout of a withdrawal is stuck: it could not be recorded, or has waited half an hour',
  },
  /** For a kind not listed here. */
  other: 'something needs your attention',
} as const;
